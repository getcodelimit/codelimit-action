import {makeStatusBadgeSvg, qualityProfilePercentage} from "../src/codelimit";

test('make 100% badge', () => {
    const codebase = {
        tree: {
            './': {
                entries: [],
                profile: [1000, 0, 0, 0]
            }
        }
    };

    const result = makeStatusBadgeSvg(codebase);

    expect(result).toContain('#4c1');
    expect(result).toContain('100%</text>');
});

test('make 80% badge', () => {
    const codebase = {
        tree: {
            './': {
                entries: [],
                profile: [400, 400, 200, 0]
            }
        }
    };

    const result = makeStatusBadgeSvg(codebase);

    expect(result).toContain('#4c1');
    expect(result).toContain('80%</text>');
})

test('make 60% badge', () => {
    const codebase = {
        tree: {
            './': {
                entries: [],
                profile: [300, 300, 400, 0]
            }
        }
    };

    const result = makeStatusBadgeSvg(codebase);

    expect(result).toContain('#fe7d37');
    expect(result).toContain('60%</text>');
})

test('make 93% badge', () => {
    const codebase = {
        tree: {
            './': {
                entries: [],
                profile: [630, 300, 70, 0]
            }
        }
    };

    const result = makeStatusBadgeSvg(codebase);

    expect(result).toContain('#4c1');
    expect(result).toContain('93%</text>');
});

test('quality profile percentages', () => {
    let result = qualityProfilePercentage([2530, 2883, 1395, 0]);

    expect(result).toEqual([36, 43, 21, 0]);

    result = qualityProfilePercentage([630, 300, 70, 0]);

    expect(result).toEqual([63, 30, 7, 0]);
});