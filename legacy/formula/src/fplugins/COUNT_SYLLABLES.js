LEN(
  REGEX_REPLACE(
    REGEX_REPLACE(
      REGEX_REPLACE(
        {TEXT},
        '(\b|\W)(?P<T>(\p{L}\p{L}-?)(?P<D>\d+([.,]\d+){0,2}\w))\s|(\p{P})+',
        '\n$<T>'
      ),
      '(?im)(^(?P<2>[eou])(?P<2>\w)$)|(?P<syllable>([aiou][ou]?)|(e+[^\nd-]))|(?P<Y>(?m)([^aeiou\n]y)|(^[^aeiou\n]+y))|(?P<point>[.])|(?P<num>\b1-689)|(?P<7>7)|(?P<e>(?m)^[^aeiou\n]+e$)|((?P<se>\b\d)(?P<_cond>nd|th\b))',
      '{$<syllable>$<num>$<point>$<7>$<Y>$<Y0>$<e>$<se>$<2>}{$<2_>$<cond>$<7>}'
    ),
    '{}|[^{}]+|({)[^}]+}', '$1'
  )
)
