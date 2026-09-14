LEN(
  REGEX_REPLACE(
    {Source},
    '^\s$|\n([^\n])[^\n]\n',
    '$1'
  )
)
