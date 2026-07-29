type SolidType = "cube" | "cuboid" | "triangular_prism" | "square_pyramid" | "cylinder" | "cone";
type PlaneFigure = {
    type: "segment";
    from: [number, number];
    to: [number, number];
} | {
    type: "line";
    from: [number, number];
    to: [number, number];
} | {
    type: "circle";
    center: [number, number];
    radius: number;
} | {
    type: "rectangle";
    x: number;
    y: number;
    width: number;
    height: number;
} | {
    type: "triangle";
    vertices: [[number, number], [number, number], [number, number]];
} | {
    type: "polygon";
    vertices: [number, number][];
};
type SolidParams = {
    a?: number;
    b?: number;
    c?: number;
    height?: number;
    radius?: number;
};
type SolidSpec = {
    type: SolidType;
    anchor: {
        x: number;
        y: number;
    };
    params: SolidParams;
    rotationDeg?: number;
};
type GeometryRecognizeResult = {
    figures: PlaneFigure[];
    solid?: SolidSpec;
    confidence?: number;
};

type RecognizeGeometryResult = {
    ok: true;
    data: GeometryRecognizeResult;
} | {
    ok: false;
    status: number;
    error: string;
};
declare function handleRecognizeGeometry(body: {
    image?: string;
    context?: {
        width?: number;
        height?: number;
    };
}, env: {
    OPENAI_API_KEY?: string;
}): Promise<RecognizeGeometryResult>;

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

export { type RecognizeGeometryResult, type RecognizeMathResult, type SolveMathResult, handleRecognizeGeometry, handleRecognizeMath, handleSolveMath };
