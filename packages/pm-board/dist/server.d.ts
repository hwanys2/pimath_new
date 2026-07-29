type SolveResult = {
    steps: string[];
    answerLatex: string;
    warnings?: string;
};

type RecognizeMathResult = {
    ok: true;
    latex: string;
    text: string;
} | {
    ok: false;
    status: number;
    error: string;
};
declare function handleRecognizeMath(body: {
    image?: string;
}, env: {
    MATHPIX_APP_ID?: string;
    MATHPIX_APP_KEY?: string;
}): Promise<RecognizeMathResult>;
type SolveMathResult = {
    ok: true;
    data: SolveResult & {
        warnings?: string;
    };
} | {
    ok: false;
    status: number;
    error: string;
};
declare function handleSolveMath(body: {
    latex?: string;
    expr?: string;
    kind?: "equation" | "inequality";
}, env: {
    OPENAI_API_KEY?: string;
}): Promise<SolveMathResult>;

export { type RecognizeMathResult, type SolveMathResult, handleRecognizeMath, handleSolveMath };
