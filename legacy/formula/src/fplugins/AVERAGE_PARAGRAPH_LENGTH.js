ROUND(
   LEN(
      REGEX_REPLACE(
         Body,
         '(?i)(\\W*(?P<sentence>(?:[A-Z0-9])(?:[^\\?\\.\\!]+|(?:(abbr[.])|(?:m(?:r|s){1,2})|(?:e[.]g[.])|(?:fig[.])|(?:\\d+[.]\\d+)))+?(?:(?P<punc>[!?.\\p{Pi}\\p{Pf}]{1,3})\\s*))\\W*)|(?s).+', '$<punc>'
      )
   ) / LEN(
      REGEX_REPLACE(
         Body, '(([^\n]+)+\n*)', '_'
      )
   ),
   2
)
