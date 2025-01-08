import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";
import {promisify} from "util";
import {makeBadge} from "badge-maker";
import {Codebase} from "./entities/Codebase";
import {info, success} from "signale";

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

export async function downloadCodeLimitBinary(version: string): Promise<string> {
    let binaryUrl;
    if (version === 'latest') {
        binaryUrl = await getLatestBinaryUrl();
    } else {
        binaryUrl = `https://github.com/getcodelimit/codelimit/releases/download/${version}/${getBinaryName()}`;
    }
    info(`Downloading CodeLimit binary from URL: ${binaryUrl}`);
    const response = await nodeFetch(binaryUrl);
    const filename = path.join(__dirname, getBinaryName());
    await streamPipeline(response.body, fs.createWriteStream(filename));
    fs.chmodSync(filename, '777');
    success(`CodeLimit binary downloaded: ${filename}`);
    return filename;
}

export function getReportContent(): string | undefined {
    return fs.readFileSync('.codelimit_cache/codelimit.json', 'utf8');
}

function makeBadgeSvg(message: string, color: string): string {
    const badge = {
        label: 'CodeLimit',
        message: message,
        color: color,
        logoBase64: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4wIiAgd2lkdGg9IjUwMCIgaGVpZ2h0PSI1MDAiIHZpZXdCb3g9IjAgMCA3NSA3NSI+DQo8cGF0aCBkPSJNMzkuMzg5LDEzLjc2OSBMMjIuMjM1LDI4LjYwNiBMNiwyOC42MDYgTDYsNDcuNjk5IEwyMS45ODksNDcuNjk5IEwzOS4zODksNjIuNzUgTDM5LjM4OSwxMy43Njl6Ig0Kc3R5bGU9InN0cm9rZTojZWZlZmVmO3N0cm9rZS13aWR0aDozO3N0cm9rZS1saW5lam9pbjpyb3VuZDtmaWxsOiNmZmZmZmY7Ig0KLz4NCjxwYXRoIGQ9Ik00OCwyNy42YTE5LjUsMTkuNSAwIDAgMSAwLDIxLjRNNTUuMSwyMC41YTMwLDMwIDAgMCAxIDAsMzUuNiIgc3R5bGU9ImZpbGw6bm9uZTtzdHJva2U6I2VmZWZlZjtzdHJva2Utd2lkdGg6NTtzdHJva2UtbGluZWNhcDpzcXVhcmUiLz4NCjwvc3ZnPg=='
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
