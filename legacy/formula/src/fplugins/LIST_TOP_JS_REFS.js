SUBSTITUTE(
    REGEX_REPLACE(
        REGEX_REPLACE(
            Source & '',
            '(\\s*(?:/[*]+([^*]|[*][^/])*[*]/|/{2,}[^\\x0a]*)\\s*)+|(?P<TOP_LVL_REFERENCES>(?m)^(((const|class|let|var|(async\\s+)?function))([^[[:print:]]|\\s)+(?<ref>\\w+).*$|((const|let|var)\\b\\s*(({(?<destructuringRefs0>[^}]*)\\s*})|(\\[(?<destructuringRefs1>[^]]*)\\s*\\])\\s*=\\s*))|(?<n>\n)+)|.+\\x0a?)+',
            '$<ref>$<destructuringRefs0>$<destructuringRefs1>$<n>'
        ),
        '^\\s+|\\s+$|[^\\pL\\w_\\x0a\\s]+|(\\x0a)+',
        '$1'
    ),
    '\n',','
)
