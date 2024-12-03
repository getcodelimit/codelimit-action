import {Octokit} from "@octokit/action";
import {Context} from "@actions/github/lib/context";
import {context} from "@actions/github";

export async function branchExists(octokit: Octokit, owner: string, repo: string, branchName: string) {
    try {
        await octokit.git.getRef({
            owner: owner, repo: repo, ref: `heads/${branchName}`
        })
        return true
    } catch (err) {
        return false
    }
}

export async function createBranch(octokit: Octokit, owner: string, repo: string, branchName: string, sha: string) {
    try {
        const res = await octokit.git.createRef({
            owner: owner, repo: repo, ref: `refs/heads/${branchName}`, sha: sha
        })
        console.log(`Branch created: ${branchName}`);
        return res
    } catch (e: any) {
        console.error(`Could not create branch \`${branchName}\` due to: ${e.message}`);
    }
}

export async function createInitialCommit(octokit: Octokit, owner: string, repo: string): Promise<string> {
    const empty_tree_object = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
    const res = await octokit.git.createCommit({
        owner: owner,
        repo: repo,
        message: 'Initial commit',
        tree: empty_tree_object,
        parents: []
    });
    return res.data.sha;
}

export function getRepoOwner(ctx: Context): string | undefined {
    return ctx.payload.repository?.owner.login
}

export function getRepoName(ctx: Context): string | undefined {
    return ctx.payload.repository?.name
}

export async function getIdentity(octokit: Octokit): Promise<{ name: string, email: string }> {
    const identityQuery = `
        query {
            viewer {
                databaseId
                login
            }
        }
    `;
    const queryResult: any = await octokit.graphql(identityQuery);
    const databaseId = queryResult?.viewer?.databaseId;
    const login = String(queryResult?.viewer?.databaseId);
    return {name: login, email: `${databaseId}+${login}@users.noreply.github.com`};
}

export async function createOrUpdateFile(octokit: Octokit, owner: string, repo: string, branchName: string, path: string, content: string) {
    let sha = undefined;
    try {
        const res = await octokit.repos.getContent({
            owner: owner,
            repo: repo,
            ref: `refs/heads/${branchName}`,
            path: path,
            headers: {
                "Accept": "application/vnd.github.object+json"
            }
        });
        sha = (res.data as any).sha;
    } catch (e) {
        /* do nothing */
    }
    const identity = await getIdentity(octokit);
    await octokit.repos.createOrUpdateFileContents({
        owner: owner,
        repo: repo,
        path: path,
        sha: sha,
        message: `Update by Code Limit`,
        branch: branchName,
        content: Buffer.from(content).toString('base64'),
        committer: {
            name: identity.name,
            email: identity.email
        }
    });
}

export async function createPRComment(octokit: Octokit, owner: string, repo: string, prNumber: number, comment: string) {
    await octokit.issues.createComment({
        owner: owner,
        repo: repo,
        issue_number: prNumber,
        body: comment
    });
}

export function isPullRequest() {
    return context.eventName === 'pull_request';
}

export function getSourceBranch() {
    if (isPullRequest()) {
        return process.env.GITHUB_HEAD_REF;
    } else {
        return process.env.GITHUB_REF_NAME;
    }
}

export async function createBranchIfNotExists(octokit: Octokit, owner: string, repo: string, branchName: string) {
    if (!await branchExists(octokit, owner, repo, branchName)) {
        const initialCommitSha = await createInitialCommit(octokit, owner, repo);
        await createBranch(octokit, owner, repo, branchName, initialCommitSha);
    } else {
        console.log(`Branch ${branchName} already exists`);
    }
}