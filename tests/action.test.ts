import {addLinkToFindingsMarkdown} from "../src/action";

test('add link to findings markdown', () => {
    let result = addLinkToFindingsMarkdown('10 more rows', 'getcodelimit', 'codelimit', 'main');

    expect(result).toBe(
        '[10 more rows](https://github.com/getcodelimit/codelimit/blob/_codelimit_reports/main/codelimit.md#findings)');

    result = addLinkToFindingsMarkdown('1 more row', 'getcodelimit', 'codelimit', 'main');

    expect(result).toBe(
        '[1 more row](https://github.com/getcodelimit/codelimit/blob/_codelimit_reports/main/codelimit.md#findings)');
});