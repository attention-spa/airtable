import React, { useState } from 'react';
import { SelectButtons } from '@airtable/blocks/ui';
import {
	SelectButtonsStyleProps as StyleProps,
	SharedSelectButtonsProps as SharedProps,
} from '@airtable/blocks/dist/types/src/ui/select_buttons';
import { RenameTypeProps } from '../utils';


type TabSelectorProps = RenameTypeProps<
	StyleProps & SharedProps,
	{options:'tabs'}
>;


const TabSelector = (props: TabSelectorProps): JSX.Element => {
	const { tabs, ...rest } = props;

	const [value, setValue] = useState(tabs[0].value);

	return (
		<SelectButtons
			value={value}
			onChange={(newValue) => setValue(newValue)}
			options={tabs}
			size='large'
			disabled={false}
			width='100%'
			{...rest}
		/>
	);
};

TabSelector({
	tabs: [
		{ value: '1', label: '1' },
		{ value: '2', label: '2' },
	],
});






