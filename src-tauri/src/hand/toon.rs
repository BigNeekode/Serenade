//! Minimal TOON parser for `hand config` output.
//!
//! TOON row blocks look like:
//! ```text
//! harnesses[5]{name,installed,model,effort}:
//!   claude,true,true,true
//!   codex,true,true,true
//! routes[6]{kind,execution_class,profile,state}:
//!   scout,mechanical,none,missing
//! ```
//! Values are quoted only when they contain `,:"` or whitespace.

/// Parse a named row table. `name` matches `name[N]{cols}:`.
/// Returns rows as split fields, or an empty vec when the table is absent/empty.
pub fn table(doc: &str, name: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut in_table = false;
    for line in doc.lines() {
        if !in_table {
            if line.starts_with(name) && line.contains('{') && line.trim_end().ends_with(':') {
                in_table = true;
            }
            continue;
        }
        // Rows are indented (two spaces). Anything else ends the table.
        if line.starts_with("  ") {
            let row = line.trim();
            if row.is_empty() {
                continue;
            }
            rows.push(split_csv(row));
        } else {
            break;
        }
    }
    rows
}

/// Parse a scalar `key: value` line (first match wins).
#[allow(dead_code)] // exercised by unit tests; kept for future config reads
pub fn scalar(doc: &str, key: &str) -> Option<String> {
    let prefix = format!("{key}: ");
    for line in doc.lines() {
        let line = line.trim_end();
        if let Some(rest) = line.strip_prefix(&prefix) {
            return Some(unquote(rest.trim()));
        }
        // also handle "key:" with empty value
        if line.trim() == format!("{key}:") {
            return Some(String::new());
        }
    }
    None
}

/// CSV split with support for double-quoted values.
fn split_csv(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' => {
                in_quotes = !in_quotes;
            }
            ',' if !in_quotes => {
                fields.push(unquote(&current));
                current.clear();
            }
            _ => current.push(c),
        }
    }
    fields.push(unquote(&current));
    fields
}

fn unquote(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"') {
        trimmed[1..trimmed.len() - 1].replace("\\\"", "\"").replace("\\\\", "\\")
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_row_tables() {
        let doc = "home: /tmp/h\nharnesses[3]{name,installed,model,effort}:\n  claude,true,true,true\n  \"grok, dev\",false,false,false\nroutes[2]{kind,execution_class,profile,state}:\n  scout,mechanical,none,missing\ncount: 2\n";
        let harnesses = table(doc, "harnesses");
        assert_eq!(harnesses.len(), 2);
        assert_eq!(harnesses[0][0], "claude");
        assert_eq!(harnesses[1][0], "grok, dev");
        let routes = table(doc, "routes");
        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0][0], "scout");
        assert_eq!(scalar(doc, "home").as_deref(), Some("/tmp/h"));
        assert_eq!(scalar(doc, "count").as_deref(), Some("2"));
        assert_eq!(scalar(doc, "missing_key"), None);
    }

    #[test]
    fn parses_empty_tables() {
        let doc = "profiles[0]{name,harness,model,effort}:\nx: 1\n";
        assert!(table(doc, "profiles").is_empty());
    }
}
