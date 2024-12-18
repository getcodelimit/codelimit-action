import {SourceFolder} from "./SourceFolder";

export interface Codebase {
    tree: { [path: string]: SourceFolder };
}