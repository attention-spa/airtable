IF(
    SUBSTITUTE(
        REGEX_REPLACE(
            {Source},
            '(?:(?<CHECK_IF_TARGET_SOURCE_CODE_IS_SHAPED_LIKE_AN_IIFE>(\\s*(?s)[/][*].+?[*][/])\\s*)|(?:\\s*(?s)[/][*].+?[*][/])?(?P<all>(?P<IS_IIFE>(?s)((const|let|var|this|[.]){0,2}\\s+\\w+\\s*=\\s*)?[!]?\\s*[(]\\s*(async\\s+)?(function)?.*[}]?\\s*[)]\\s*[(]\\s*[)]\\s*([/][*][^\\/*]*([*][\\/][^*])*[*][/]\\s*)?$)(?s).*)|(?s).+)+',
            '🔎NOT_AN$<IS_IIFE>_IIFE🔍❓\n'
        ),
        '🔎NOT_AN_IIFE🔍❓\n',
        '') != '',
        'IIFE',

    IF(
        REGEX_REPLACE(
            Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|([\\s;]+$)', '$<str>$<n0>'
        ) = '',
        'N/A',

        IF(
            LEN(
                REGEX_REPLACE(
                    REGEX_REPLACE(
                        REGEX_REPLACE(
                            REGEX_REPLACE(
                                Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'), '(?m)^(((((async\\x20+)?function)|((class)|(const)|(let)|(var)))\\s+(?P<ref0>\\w+).*)|.*)$', '$<ref0>\n'), '^\\s+|(\n)\n+|\\s+$', '$1'), '[^\n]*([^\n])\n?', '$1')) < 2,
            IF(
                IF(
                    TRIM(
                        REGEX_REPLACE(
                            REGEX_REPLACE(
                                REGEX_REPLACE(
                                    Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'), '((?s).*?((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))).*?|.*?(?P<es6_module>\\bexport\\b).*)|.+', '@es6Module{$<es6_module>}'), '((@(?P<save>\\w+)[{][^}]+[}])|(@\\w+[{][}])+)+', '$<save>')),
                    'ES6 module', TRIM(
                        REGEX_REPLACE(
                            REGEX_REPLACE(
                                REGEX_REPLACE(
                                    Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'),
                                '\\s*(?:((?:class)|(?:(?:async\\s+)?(?:function)))|(?:const|let|var)\\s+'
                                & REGEX_REPLACE(
                                    REGEX_REPLACE(
                                        REGEX_REPLACE(
                                            Source,
                                            '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)',
                                            '$<str>$<n0>$<newline1>'
                                        ),
                                        '(?m)^(((((async\\x20+)?function)|((class)|(const)|(let)|(var)))\\s+(?P<ref0>\\w+).*)|.*)$',
                                        '$<ref0>\n'
                                    ),
                                    '^\\s+|(\n)\n+|\\s+$', '$1'
                                ) & '(?s).*)|.+', '$1') &
                            REGEX_REPLACE(
                                REGEX_REPLACE(
                                    Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'),
                                '(\\s*(((const|let|var)\\s+)\\w+\\s*=\\s*){0,'
                                & LEN(
                                    REGEX_REPLACE(
                                        REGEX_REPLACE(
                                            REGEX_REPLACE(
                                                REGEX_REPLACE(
                                                    Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'), '(?m)^(((((async\\x20+)?function)|((class)|(const)|(let)|(var)))\\s+(?P<ref0>\\w+).*)|.*)$', '$<ref0>\n'), '^\\s+|(\n)\n+|\\s+$', '$1'), '[^\n]*([^\n])\n?', '$1')) &
                                '}((?P<object>[{]|(((new\\s+)?(Object)\\s*[(])|(Object\\s*[.]\\s*create\\s*[(])))|(?P<array>[[]|(((new\\s+)?(Array)\\s*[(]))|(Array\\s*[.](from)\\s*[(]))|(?P<string>[\\x22\\x27\\x60])|(?P<number>\\d)|(?P<regex>([\\x2f][^\\x2f][^\n]*[\\x2f])|((new\\s*)?(Regexp)\\s*[(])))?(?s).*)',
                                '@object{$<object>}@array{$<array>}@string{$<string>}@number{$<number>}@regex{$<regex>}'
                                &
                                REGEX_REPLACE(
                                    REGEX_REPLACE(
                                        Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'),
                                    '(^(?s)((?P<anon>\\s*([(]([^()]*[(])*([^()]*[)])*[)])|(\\w+)\\s*=>\\s*).*)|.+)',
                                    '@anonymousFunction{$<anon>}'
                                )
                            ),
                            '((@(?P<save>\\w+)[{][^}]+[}])|(@\\w+[{][}])+)+', '$<save>'))),
                IF(
                    TRIM(
                        REGEX_REPLACE(
                            REGEX_REPLACE(
                                REGEX_REPLACE(
                                    Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'), '((?s).*?((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))).*?|.*?(?P<es6_module>\\bexport\\b).*)|.+', '@es6Module{$<es6_module>}'), '((@(?P<save>\\w+)[{][^}]+[}])|(@\\w+[{][}])+)+', '$<save>')),

                    'ES6 module', TRIM(
                        REGEX_REPLACE(
                            REGEX_REPLACE(
                                REGEX_REPLACE(
                                    Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'),
                                '\\s*(?:((?:class)|(?:(?:async\\s+)?(?:function)))|(?:const|let|var)\\s+'
                                & REGEX_REPLACE(
                                    REGEX_REPLACE(
                                        REGEX_REPLACE(
                                            Source,
                                            '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)',
                                            '$<str>$<n0>$<newline1>'
                                        ),
                                        '(?m)^(((((async\\x20+)?function)|((class)|(const)|(let)|(var)))\\s+(?P<ref0>\\w+).*)|.*)$',
                                        '$<ref0>\n'
                                    ),
                                    '^\\s+|(\n)\n+|\\s+$', '$1'
                                ) & '(?s).*)|.+', '$1') &
                            REGEX_REPLACE(
                                REGEX_REPLACE(
                                    Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'),
                                '(\\s*(((const|let|var)\\s+)\\w+\\s*=\\s*){0,'
                                & LEN(
                                    REGEX_REPLACE(
                                        REGEX_REPLACE(
                                            REGEX_REPLACE(
                                                REGEX_REPLACE(
                                                    Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'), '(?m)^(((((async\\x20+)?function)|((class)|(const)|(let)|(var)))\\s+(?P<ref0>\\w+).*)|.*)$', '$<ref0>\n'), '^\\s+|(\n)\n+|\\s+$', '$1'), '[^\n]*([^\n])\n?', '$1')) &
                                '}((?P<object>[{]|(((new\\s+)?(Object)\\s*[(])|(Object\\s*[.]\\s*create\\s*[(])))|(?P<array>[[]|(((new\\s+)?(Array)\\s*[(]))|(Array\\s*[.](from)\\s*[(]))|(?P<string>[\\x22\\x27\\x60])|(?P<number>\\d)|(?P<regex>([\\x2f][^\\x2f][^\n]*[\\x2f])|((new\\s*)?(Regexp)\\s*[(])))?(?s).*)',
                                '@object{$<object>}@array{$<array>}@string{$<string>}@number{$<number>}@regex{$<regex>}'
                                &
                                REGEX_REPLACE(
                                    REGEX_REPLACE(
                                        Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'),
                                    '(^(?s)((?P<anon>\\s*([(]([^()]*[(])*([^()]*[)])*[)])|(\\w+)\\s*=>\\s*).*)|.+)',
                                    '@anonymousFunction{$<anon>}'
                                )
                            ),
                            '((@(?P<save>\\w+)[{][^}]+[}])|(@\\w+[{][}])+)+', '$<save>'))),
                'script'),
            IF(
                TRIM(
                    REGEX_REPLACE(
                        REGEX_REPLACE(
                            REGEX_REPLACE(
                                Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'), '((?s).*?((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))).*?|.*?(?P<es6_module>\\bexport\\b).*)|.+', '@es6Module{$<es6_module>}'), '((@(?P<save>\\w+)[{][^}]+[}])|(@\\w+[{][}])+)+', '$<save>')), 'ES6 module',
                IF(
                    TRIM(
                        REGEX_REPLACE(
                            Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|([\\s;]+$)', '$<str>$<n0>')) = '', '',
                    IF(
                        LEN(
                            REGEX_REPLACE(
                                REGEX_REPLACE(
                                    REGEX_REPLACE(
                                        REGEX_REPLACE(
                                            Source, '(^\\s+)|(((?P<str>(\\x22([^\\x22\n\\x5c]+(\\x5c\\x22)*)+\\x22)|(\\x27([^\\x27\n\\x5c]+(\\x5c\\x27)*)+\\x27)|(\\x60([^\\x60\\x5c]+(\\x5c\\x60)*)+\\x60))|((^\\s*(\\s*(?s)[/][*].+?[*][/])\\s*)|(\\s*(?s)[/][*].+?[*][/])((\\s*$)|(?P<n0>\n)\\s*))|((?m)\\s*[/]{2}.*$)))|((?P<newline1>\n)\n+)|([\\s;]+$)', '$<str>$<n0>$<newline1>'), '(?m)^(((((async\\x20+)?function)|((class)|(const)|(let)|(var)))\\s+(?P<ref0>\\w+).*)|.*)$', '$<ref0>\n'), '^\\s+|(\n)\n+|\\s+$', '$1'), '[^\n]*([^\n])\n?', '$1')) > 1, 'script'))))

    )
)
