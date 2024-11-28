import {Octokit} from "@octokit/action";
import {Context} from "@actions/github/lib/context";

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

export async function getBranchHeadSha(octokit: Octokit, owner: string, repo: string, branch: string) {
    try {
        const res = await octokit.git.getRef({
            owner: owner, repo: repo, ref: `heads/${branch}`
        })
        const ref = res.data.object
        return ref.sha
    } catch (e) {
        return undefined
    }
}

export function getDefaultBranch(ctx: Context): string | undefined {
    return ctx.payload.repository?.default_branch
}

export function getRepoOwner(ctx: Context): string | undefined {
    return ctx.payload.repository?.owner.login
}

export function getRepoName(ctx: Context): string | undefined {
    return ctx.payload.repository?.name
}