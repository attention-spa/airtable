LEN(
    REGEX_REPLACE(
        { AttachmentsField } & "",
        "\\x22?(?<filename>.+?)\\x20+(?<CTRL_CHAR>\\x28)(?<fileurl>https?\\x3a\\x2f{2}[^\\x29]+)\\x29\\x22?(\\x2c\\x20+|$)",
        "$<CTRL_CHAR>"
    )
)