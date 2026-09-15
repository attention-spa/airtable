import React, { Attributes, ReactChildren, ReactElement } from "react"


export type CodeContainerProps = {
    code: string,
    /** Acts as the container's heading. */
    summary?: string,
    language?: string,
    /** Set to true to have the code container open by default. */
    open?: boolean
};

/** Renders a toggleable code container. */
export const RenderCodeContainer = (props: CodeContainerProps | string): ReactElement => {

    const {
        code = typeof props === 'string' ? props : '',
        summary = '',
        language = '',
        open
    } = props as CodeContainerProps;

    if (!code || typeof code !== 'string')
        throw `#ERROR@RenderCodeContainer: Code must be a ${code === '' ? 'non-empty' : ''} string!`;

    return React.createElement(
        'details',
        open === true ? { open } : {},
        <summary>{summary}</summary>,
        <br />,
        ['```' + language, code, '```'].join('\n')
    );

};