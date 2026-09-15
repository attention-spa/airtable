import React, { Attributes, ReactChildren, ReactElement } from 'react';

export type CollapsibleBox = {
	/** Acts as the container's heading. */
	summary?: string;
	/** Set to true to have the code container open by default. */
	open?: boolean;
	children?: (ChildNode | ReactElement)[];
};

const a = 'af';
let kk = 'a';

export const CollapsibleBox: (props: CollapsibleBox) => JSX.Element = ({
	summary = '',
	children = [],
	...otherProps
}) => (
	<details
		className='CollapsibleBox'
		{...otherProps}
	>
		<summary>{summary}</summary>
		{children}
	</details>
);
