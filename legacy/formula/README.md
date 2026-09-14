Airtable formulas developed for and with [Mable Module Manager](https://github.com/dddominikk/mable_modules).

## Formulas
<details>
<summary>GET_GLOBAL_VARS</summary>
Returns a comma-delimited list of unique references to global Airtable variables in JavaScript source code.

- the formula accounts for naive false positives by ignoring stringified references to its target keywords
  - e.g., `console.log('base')` will correctly return `console` instead of `console,base`
- template literals are not part of the current spec
  - e.g., ``console.log(`${'base'}`)`` will erroneously yield `console,base` instead of just `console`
- the backticks themselves are still treated like regular quotation marks/string identifiers
  - e.g., ``output.inspect(`session`)`` will correctly return `output` instead of `output,session`
  
</details>


  
</details>
<details>
<summary>LIST_TOP_JS_REFS</summary>
Returns a comma-delimited list of top-scoped variables from JavaScript source code.
</details>



<details>
<summary>COUNT_BYTES</summary>
Returns the number of bytes in a given string(ified value).
</details>

<details>
<summary>COUNT_PARAGRAPHS</summary>
Returns the number of paragraphs in a given text field.
</details>

<details>
<summary>COUNT_SYLLABLES</summary>
A syllable counter using regular expressions.
The implementation accounts for the most common phonetic gotchas of the English language. That said, it is incomplete, so do not rely on this formula if you require maximally accurate results. The latest build has a ±9% margin of error, based on a sample of 175,000 words (200 news articles and opinion pieces scrapped from Reuters and 50 Airtable blog posts).


Behavior & Edge Cases

The letter 'y' will be correctly identified as a sound delimiter only if it preceeds all conventional vowels in a given word.

Support for single-digit numbers is hard-coded. Ditto for the decimal point, which counts as one syllable.


Misc.

The innermost REGEX_REPLACE() call is the latest version of the WORD_TOKENS() formula, also hosted as part of Mable.


### References
- [English syllables](https://writingexplained.org/grammar-dictionary/syllable "What is a Syllable?")
- [State machine syllable counters](https://skeoop.github.io/labs/Lab-Syllable-Counter.pdf)
</details>


<details>
<summary>COMPLEX_WORD_PERCENTAGE</summary>

#### __[src/COMPLEX_WORD_PERCENTAGE.js][complexWordPercentage]__
- Returns the percentage of word-like tokens in a target string that are deemed complex, using the [Dale-Chall 3,000-word list for readability algorithms][dcAlgoWiki].</details>



[complexWordPercentage]: src/COMPLEX_WORD_PERCENTAGE.js
[dcAlgoWiki]: https://en.wikipedia.org/wiki/Dale%E2%80%93Chall_readability_formula


