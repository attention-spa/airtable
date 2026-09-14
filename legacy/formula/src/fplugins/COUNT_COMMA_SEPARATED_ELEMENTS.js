LEN(
  REGEX_REPLACE(
    tags,'([^,]){1,}(?:,\\x20)?','$1'
    )
)
