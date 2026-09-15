import { initializeBlock } from '@airtable/blocks/ui';
import React from 'react';
import { RenderBox } from './components/Container';
import { Button } from '@airtable/blocks/ui';
import { CollapsibleBox } from './components/CollapsibleBox';

function HelloWorldTypescriptApp() {

    const B1 = <
        Button
        className='NavButton'
        children='Button 1'
    />

    const NavBar = RenderBox({
        as: 'nav',
        width: '100%',
        height: '5%',
        border: '1px solid black',
        className: 'NAV_BAR',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        children: [B1]
    });


    const rn = CollapsibleBox({ summary: 'yo', open: true, children: [<h1>hello</h1>, <p>This is an article.</p>] })

    return <RenderBox
        className='ROOT_BOX'
        width='100%'
        height='100%'
        children={[
            NavBar, rn
        ]}
    />
}

initializeBlock(() => <HelloWorldTypescriptApp />);
