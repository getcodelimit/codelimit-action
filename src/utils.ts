import {context} from "@actions/github";
import {Octokit} from "@octokit/action";

export async function getChangedFiles(token: string) {
    const eventName = context.eventName
    if (eventName === undefined) {
        return ['.'];
    }
    let base;
    let head;
    if (eventName === 'pull_request') {
        base = context.payload.pull_request?.base?.sha
        head = context.payload.pull_request?.head?.sha
    } else {
        base = context.payload.before
        head = context.payload.after
    }
    const octokit = new Octokit({auth: token});
    const response = await octokit.repos.compareCommits({
        base, head, owner: context.repo.owner, repo: context.repo.repo
    });
    if (response.status !== 200) {
        return ['.'];
    }
    const files = response.data.files
    const result = [];
    if (files) {
        for (const file of files) {
            const filename = file.filename
            if (file.status === 'modified' || file.status === 'added') {
                result.push(filename);
            }
        }
    }
    return result;
}