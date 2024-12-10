import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";
import {promisify} from "util";
import {makeBadge} from "badge-maker";

const streamPipeline = promisify(require('stream').pipeline);

function getBinaryName() {
    const binaries: { [platform: string]: string } = {
        'darwin': 'codelimit-macos',
        'win32': 'codelimit.exe',
        'linux': 'codelimit-linux'
    };
    if (process.env.RUNNER_OS) {
        const platform = process.env.RUNNER_OS.toLowerCase();
        if (platform in binaries) {
            return binaries[platform];
        }
    }
    if (process.platform in binaries) {
        return binaries[process.platform];
    }
    return binaries['linux'];
}

async function getLatestBinaryUrl() {
    const latestUrl = 'https://github.com/getcodelimit/codelimit/releases/latest';
    const res = await nodeFetch(latestUrl);
    const downloadUrl = res.url.replace('/tag/', '/download/');
    return `${downloadUrl}/${getBinaryName()}`;
}

export async function downloadCodeLimitBinary() {
    const binaryUrl = await getLatestBinaryUrl();
    console.log(`Downloading Code Limit binary from URL: ${binaryUrl}`);
    const response = await nodeFetch(binaryUrl);
    const filename = path.join(__dirname, getBinaryName());
    await streamPipeline(response.body, fs.createWriteStream(filename));
    fs.chmodSync(filename, '777');
    console.log(`Code Limit binary downloaded: ${filename}`);
    return filename;
}

export function getReportContent(): string | undefined {
    return fs.readFileSync('.codelimit_cache/codelimit.json', 'utf8');
}

function makeBadgeSvg(message: string, color: string): string {
    const badge = {
        label: 'Code Limit',
        message: message,
        color: color
    };
    return makeBadge(badge);
}

export function getBadgeContent(reportContent: string | undefined): string {
    if (!reportContent) {
        return makeBadgeSvg('Not found', 'grey');
    } else {
        const reportJson = JSON.parse(reportContent);
        const profile = reportJson.codebase.tree['./'].profile
        if (profile[3] > 0) {
            return makeBadgeSvg('Needs refactoring', 'red');
        } else if (profile[2] > 0) {
            return makeBadgeSvg('Needs refactoring', 'orange');
        } else {
            return makeBadgeSvg('Passed', 'brightgreen');
        }
    }
}