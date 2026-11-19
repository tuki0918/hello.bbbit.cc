import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const roster = "CONTRIBUTORS.txt";
const bot = "github-actions[bot]";
const username = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i;
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

function fetchRef(ref) {
  // Fetch the objects for comparison only. The worktree stays on the trusted branch.
  git("fetch", "--quiet", "--no-tags", "origin", ref);
  return git("rev-parse", "FETCH_HEAD").trim();
}

function readRoster(commit) {
  const [metadata, filename] = git("ls-tree", commit, "--", roster).trimEnd().split("\t");
  const blob = /^100644 blob ([a-f0-9]+)$/.exec(metadata)?.[1];
  if (filename !== roster || !blob) throw new Error(`${roster} must be a regular file.`);
  const text = git("cat-file", "blob", blob);
  const names = text === "" ? [] : text.replace(/\r?\n$/, "").split(/\r?\n/);
  if (names.some((name) => !username.test(name))) throw new Error("Use one GitHub username per line.");
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    throw new Error("Duplicate usernames are not allowed.");
  }
  return { blob, text, names };
}

function requireRosterOnly(base, head) {
  const changes = git("diff", "--name-status", "--no-renames", "--ignore-submodules=none", "-z", base, head, "--");
  if (changes !== `M\0${roster}\0`) throw new Error(`Change only ${roster}.`);
}

function validateRequest(base, head, login) {
  // 実績の解除は参加案内の演出。PRの受付では実績の達成状況を厳密に検証しない。
  // GitHub上の投稿者本人のユーザー名と、名簿への追加内容を検証する。
  const common = git("merge-base", base, head).trim();
  requireRosterOnly(common, head);
  const before = new Set(readRoster(common).names);
  const after = readRoster(head).names;
  const proposed = new Set(after);
  const additions = after.filter((name) => !before.has(name));
  if (additions.length !== 1 || additions[0].toLowerCase() !== login || [...before].some((name) => !proposed.has(name))) {
    throw new Error("Add only your own GitHub username and keep all existing entries.");
  }
}

async function register({ repository, token, number, apiUrl }) {
  if (!Number.isSafeInteger(number) || number < 1 || !repository || !token) {
    throw new Error("The workflow needs a repository, token, and pull request number.");
  }
  function api(method, route, body, allowed = []) {
    return fetch(`${apiUrl}/repos/${repository}${route}`, {
      method,
      redirect: "error",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async (response) => {
      if (allowed.includes(response.status) || response.status === 204) return null;
      const data = await response.json();
      if (!response.ok) throw new Error(`GitHub ${method} ${route} returned ${response.status}: ${JSON.stringify(data.message)}`);
      return data;
    });
  }

  const repo = await api("GET", "");
  const sourcePath = `/pulls/${number}`;
  const source = await api("GET", sourcePath);
  const baseBranch = repo.default_branch;
  const baseRef = `refs/heads/${baseBranch}`;
  const activeRequest = (pull) => pull.state === "open" && !pull.draft && pull.base.ref === baseBranch;
  if (!activeRequest(source) || source.user.type !== "User") return;
  if (!username.test(source.user.login)) throw new Error("The request must have a valid GitHub username.");
  const login = source.user.login.toLowerCase();
  const sourceHead = fetchRef(`refs/pull/${number}/head`);
  if (sourceHead !== source.head.sha) return; // The newer synchronize event handles the updated request.

  const latestRequest = async () => {
    const pull = await api("GET", sourcePath);
    return activeRequest(pull) && pull.head.sha === sourceHead;
  };
  const title = `Register @${login} from PR #${number}`;
  const approval = `Registered @${login} in \`${roster}\`.`;
  const webUrl = `https://github.com/${repository}`;
  async function finishRequest(resultUrl) {
    if (!await latestRequest()) return;
    const reviews = await api("GET", `${sourcePath}/reviews?per_page=100`);
    const approved = reviews.some((review) => review.user?.login === bot && review.state === "APPROVED" &&
      review.commit_id === sourceHead && review.body?.startsWith(approval));
    if (!approved) {
      await api("POST", `${sourcePath}/reviews`, {
        event: "APPROVE",
        commit_id: sourceHead,
        body: `${approval} The sorted roster was applied in ${resultUrl}.`,
      });
    }
    if (await latestRequest()) await api("PATCH", sourcePath, { state: "closed" });
  }

  const mergeMethod = repo.allow_squash_merge ? "squash" : repo.allow_merge_commit ? "merge" : "rebase";
  for (let attempt = 0; attempt < 3; attempt++) {
    const base = fetchRef(baseRef);
    validateRequest(base, sourceHead, login);
    const current = readRoster(base);
    if (current.names.some((name) => name.toLowerCase() === login)) {
      // Resume a run that already merged its registration before approving the request.
      const recorded = git("log", "-1", "--format=%H", `--grep=^${title}$`, base, "--", roster).trim();
      if (recorded) await finishRequest(`${webUrl}/commit/${recorded}`);
      else console.log(`@${login} is already registered.`);
      return;
    }
    if (!await latestRequest()) return;

    const sorted = [...current.names, login].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })).join("\n") + "\n";
    const branch = `contributor-registrations/${number}-${sourceHead.slice(0, 12)}-${base.slice(0, 12)}`;
    const refPath = `/git/ref/heads/${branch}`;
    const existing = await api("GET", refPath, undefined, [404]);
    if (!existing) await api("POST", "/git/refs", { ref: `refs/heads/${branch}`, sha: base });
    if (!existing || existing.object.sha === base) {
      await api("PUT", `/contents/${roster}`, {
        branch,
        message: title,
        sha: current.blob,
        content: Buffer.from(sorted, "utf8").toString("base64"),
      });
    }

    const normalizedHead = fetchRef(`refs/heads/${branch}`);
    const parents = git("rev-list", "--parents", "-n", "1", normalizedHead).trim().split(" ");
    requireRosterOnly(base, normalizedHead);
    if (parents.length !== 2 || parents[1] !== base || readRoster(normalizedHead).text !== sorted) {
      throw new Error("The registration branch does not match the generated roster.");
    }
    if (!await latestRequest()) return;

    const query = new URLSearchParams({ state: "open", head: `${repo.owner.login}:${branch}`, base: baseBranch });
    const existingPulls = await api("GET", `/pulls?${query}`);
    const registration = existingPulls[0] ?? await api("POST", "/pulls", {
      title,
      head: branch,
      base: baseBranch,
      body: `Automatically applies the sorted roster for contributor request #${number}.`,
    });
    if (registration.user?.login !== bot || registration.head.sha !== normalizedHead) {
      throw new Error("The registration PR does not match the generated commit.");
    }
    const registrationPath = `/pulls/${registration.number}`;
    for (const wait of [0, 1000, 2000]) {
      if (wait) await delay(wait); // GitHub may still be calculating mergeability.
      if (!await latestRequest()) {
        await api("PATCH", registrationPath, { state: "closed" });
        return;
      }
      if (fetchRef(baseRef) !== base) break;
      const merged = await api("PUT", `${registrationPath}/merge`, {
        sha: normalizedHead,
        merge_method: mergeMethod,
        commit_title: title,
      }, [405, 409, 422]);
      if (merged?.merged) {
        await finishRequest(`${webUrl}/pull/${registration.number}`);
        return;
      }
    }
    if (fetchRef(baseRef) === base) {
      throw new Error(`GitHub did not merge ${webUrl}/pull/${registration.number}. Check the default branch requirements.`);
    }
    await api("PATCH", registrationPath, { state: "closed" });
  }
  throw new Error("The default branch kept changing. Retry this workflow with the same request number.");
}

await register({
  repository: process.env.GITHUB_REPOSITORY,
  token: process.env.GH_TOKEN,
  number: Number(process.env.CONTRIBUTOR_PR),
  apiUrl: process.env.GITHUB_API_URL || "https://api.github.com",
});
