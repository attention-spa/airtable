import React from 'react';

type ObjectViewerProps = {
    data: Record<string, any>;
}

const renderValue = (value: any) =>
    typeof value === 'object' && value !== null
        ? <ObjectViewer data={value} />
        : <span>{value}</span>;

type TypeofResult<T> = {
    typeofData: 'array' | 'null' | 'number' | 'string' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function',
    notPrimitive: boolean,
    data: T
};

const Typeof = (data: unknown): TypeofResult<typeof data> => {
    const typeofData = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
    const notPrimitive = ['array', 'object', 'function'].includes(typeofData);
    return { typeofData, notPrimitive, data };
}



export const ObjectViewer: React.FC<ObjectViewerProps> = ({ data }) => {

    const renderValue = (value: any) => {
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                return (
                    <div>
                        {value.map((item: any, index: number) => (
                            <div key={index}>
                                <span>[{index}]</span> {renderValue(item)}
                            </div>
                        ))}
                    </div>
                );
            } else {
                return <ObjectViewer data={value} />;
            }
        } else {
            return <span>{value.toString()}</span>;
        }
    };

    const STYLE = { marginLeft: '20px', borderLeft: '1px solid #ccc', paddingLeft: '10px' };
    const props = {};

    const el = React.createElement('details', {
        key: 'ObjectViewerTree',
        style: STYLE, ...props, children: [
            <summary key="summary" style={{ cursor: 'pointer' }}>
                {Array.isArray(data) ? 'Array' : 'Object'}
            </summary>,
            <div key="ObjectViewerNode">
                {Array.isArray(data) ? (
                    renderValue(data)
                ) : (
                    Object.entries(data).map(([key, value]) => (
                        <div key={key || 'defaultKey'}>
                            <strong>{key || 'defaultKey'}:</strong> {renderValue(value)}
                        </div>
                    ))
                )}
            </div>
        ]
    });


    return el;
};


export const Present = ({ data }) => {
    const D = Typeof(data)

    const TARGET = typeof data === 'function' ? data() : data;
    const KEY = typeof data === 'function' ? data?.name : D.notPrimitive ? Object.keys(data) : D.data;

    const EL = React.createElement('div', {
        id: '___RES', children: [
            <h1 key="h1">{KEY}</h1>,
            <ObjectViewer key="objectViewer" data={TARGET} />
        ]
    });

    return EL;
};