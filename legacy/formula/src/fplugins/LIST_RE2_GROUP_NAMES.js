TRIM(
  REGEX_REPLACE(
    {regexExpressionString},
    '(?s).*?\\x28\x3fP?<(?<re2_group_name>[^>]+)>[^)]*\\x29|.+?',
    '\n$<re2_group_name>'
  )
)
