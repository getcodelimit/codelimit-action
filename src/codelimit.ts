import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";
import {promisify} from "util";
import {makeBadge} from "badge-maker";
import {Codebase} from "./entities/Codebase";

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
    console.log(`Downloading CodeLimit binary from URL: ${binaryUrl}`);
    const response = await nodeFetch(binaryUrl);
    const filename = path.join(__dirname, getBinaryName());
    await streamPipeline(response.body, fs.createWriteStream(filename));
    fs.chmodSync(filename, '777');
    console.log(`CodeLimit binary downloaded: ${filename}`);
    return filename;
}

export function getReportContent(): string | undefined {
    return fs.readFileSync('.codelimit_cache/codelimit.json', 'utf8');
}

function makeBadgeSvg(message: string, color: string): string {
    const badge = {
        label: 'CodeLimit',
        message: message,
        color: color
    };
    return makeBadge(badge);
}

export function makeNotFoundBadgeSvg(): string {
    return makeBadgeSvg('Not found', 'grey');
}

export function makeStatusBadgeSvg(codebase: Codebase): string {
    const profile = codebase.tree['./'].profile
    if (profile[3] > 0) {
        return makeBadgeSvg('Needs refactoring', 'red');
    } else {
        const profile2Percentage = Math.round((profile[2] / (profile[0] + profile[1] + profile[2])) * 100);
        const color = profile2Percentage > 20 ? 'orange' : 'brightgreen';
        return makeBadgeSvg(`${100 - profile2Percentage}%`, color);
    }
}
