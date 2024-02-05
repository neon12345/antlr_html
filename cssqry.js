/*
license MIT
https://github.com/danburzo/selery
commit: 456f6ba02c676ff19d2840ed00982bb52b9a8f52 with changes
*/
(function (module) {
    module.init = function(adapter) {
        const IdentStartCodePoint = /[^\x00-\x7F]|[a-zA-Z_]/;
        const IdentCodePoint = /[^\x00-\x7F]|[-\w]/;

        const Tokens = {
            AtKeyword: 'at-keyword',
            BraceClose: '}',
            BraceOpen: '{',
            BracketClose: ']',
            BracketOpen: '[',
            Colon: 'colon',
            Comma: 'comma',
            Delim: 'delim',
            Dimension: 'dimension',
            Function: 'function',
            Hash: 'hash',
            Ident: 'ident',
            Number: 'number',
            ParenClose: ')',
            ParenOpen: '(',
            Semicolon: 'semicolon',
            String: 'string',
            Whitespace: 'whitespace'
        };

        /*
            Preprocess the selector according to:
            https://drafts.csswg.org/css-syntax/#input-preprocessing
        */
        const preprocess = str =>
            str
                // We won't be needing trailing whitespace
                .replace(/^\s+|\s+$/, '')
                // Normalize newline characters
                .replace(/\f|\r\n?/g, '\n')
                // Some Unicode characters are not supported
                .replace(/[\u0000\uD800-\uDFFF]/g, '\uFFFD');

        const tokenize = str => {
            let chars = preprocess(str).split('');
            let tokens = [];

            const next = () => chars.shift();
            const reconsume = ch => chars.unshift(ch);
            const peek = n => chars[n || 0];
            const eof = () => !chars.length;
            const size = () => chars.length;

            let ch, ref_ch, token;

            /* 
                Consume an escape sequence.

                TODO: handle newlines and hex digits
            */
            const is_esc = () => size() > 1 && peek() === '\\' && peek(1) !== '\n';
            const esc = () => {
                let v = '';
                if (eof()) {
                    throw new Error('Unexpected end of input, unterminated escape sequence');
                } else {
                    // Consume escaped character
                    v += next();
                }
                return v;
            };

            /*
                4.3.10. Check if three code points would start a number
                https://drafts.csswg.org/css-syntax/#starts-with-a-number
            */
            const is_num = () => {
                let ch = peek(),
                    ch1 = peek(1);
                if (ch === '-' || ch === '+') {
                    return /\d/.test(ch1) || (ch1 === '.' && /\d/.test(peek(2)));
                }
                if (ch === '.') {
                    return /\d/.test(ch1);
                }
                return /\d/.test(ch);
            };

            /*
                4.3.3. Consume a numeric token
                https://drafts.csswg.org/css-syntax/#consume-numeric-token
            */
            const num = () => {
                let value = '';
                if (/[+-]/.test(peek())) {
                    value += next();
                }
                value += digits();
                if (peek() === '.' && /\d/.test(peek(1))) {
                    value += next() + digits();
                }
                if (/e/i.test(peek())) {
                    if (/[+-]/.test(peek(1)) && /\d/.test(peek(2))) {
                        value += next() + next() + digits();
                    } else if (/\d/.test(peek(1))) {
                        value += next() + digits();
                    }
                }
                if (is_ident()) {
                    return {
                        type: Tokens.Dimension,
                        value,
                        unit: ident()
                    };
                }
                return {
                    type: Tokens.Number,
                    value
                };
            };

            /*
                Consume digits
            */
            const digits = () => {
                let v = '';
                while (/\d/.test(peek())) {
                    v += next();
                }
                return v;
            };

            /*
                Check if the stream starts with an identifier.
            */

            const is_ident = () => {
                if (!size()) {
                    return false;
                }
                let ch = peek();
                if (ch.match(IdentStartCodePoint)) {
                    return true;
                }
                if (ch === '-') {
                    if (size() < 2) {
                        return false;
                    }
                    let ch1 = peek(1);
                    if (ch1.match(IdentCodePoint) || ch1 === '-') {
                        return true;
                    }
                    if (ch1 === '\\') {
                        return !!esc();
                    }
                    return false;
                }
                if (ch === '\\') {
                    return !!esc();
                }
                return false;
            };

            /*
                Consume an identifier.
            */
            const ident = () => {
                let v = '',
                    ch;
                while (!eof() && (peek().match(IdentCodePoint) || peek() === '\\')) {
                    v += (ch = next()) === '\\' ? esc() : ch;
                }
                return v;
            };

            /*
                Consume an ident-like token.
            */
            const identlike = () => {
                let v = ident();
                // TODO: handle URLs
                if (peek() === '(') {
                    next();
                    return {
                        type: Tokens.Function,
                        value: v
                    };
                }
                return {
                    type: Tokens.Ident,
                    value: v
                };
            };

            while (!eof()) {
                ch = next();

                /* 
                    Consume comments
                */
                if (ch === '/' && peek() === '*') {
                    next(); // consume *
                    while (!eof() && ((ch = next()) !== '*' || peek() !== '/')) {
                        if (ch === '\\') {
                            esc();
                        }
                    }
                    if (eof()) {
                        throw new Error('Unexpected end of input, unterminated comment');
                    }
                    next(); // consume /
                    continue;
                }

                /*
                    Consume whitespace
                */
                if (ch.match(/[\n\t ]/)) {
                    while (!eof() && peek().match(/[\n\t ]/)) {
                        next();
                    }
                    tokens.push({ type: Tokens.Whitespace });
                    continue;
                }

                /* 
                    Consume strings
                */
                if (ch === '"' || ch === "'") {
                    ref_ch = ch;
                    token = {
                        type: Tokens.String,
                        value: ''
                    };
                    while (!eof() && (ch = next()) !== ref_ch && ch !== '\n') {
                        token.value += ch === '\\' ? esc() : ch;
                    }
                    if (ch === ref_ch) {
                        tokens.push(token);
                        continue;
                    }
                    if (ch === '\n') {
                        // TODO: spec says to return bad-string token here, relevant?
                        throw new Error('Unexpected newline character inside string');
                    }
                    if (eof()) {
                        throw new Error(
                            `Unexpected end of input, unterminated string ${token.value}`
                        );
                    }
                }

                /* 
                    Consume IDs 
                */
                if (ch === '#') {
                    if (!eof() && (peek().match(IdentCodePoint) || is_esc())) {
                        token = {
                            type: Tokens.Hash
                        };
                        if (is_ident()) {
                            token.id = true;
                        }
                        token.value = ident();
                        tokens.push(token);
                    } else {
                        tokens.push({ type: Tokens.Delim, value: ch });
                    }
                    continue;
                }

                if (ch === '(') {
                    tokens.push({ type: Tokens.ParenOpen });
                    continue;
                }

                if (ch === ')') {
                    tokens.push({ type: Tokens.ParenClose });
                    continue;
                }

                if (ch === '+') {
                    if (is_num()) {
                        reconsume(ch);
                        tokens.push(num());
                    } else {
                        tokens.push({ type: Tokens.Delim, value: ch });
                    }
                    continue;
                }

                if (ch === ',') {
                    tokens.push({ type: Tokens.Comma });
                    continue;
                }

                if (ch === '-') {
                    if (is_num()) {
                        reconsume(ch);
                        tokens.push(num());
                    } else if (is_ident()) {
                        reconsume(ch);
                        tokens.push({
                            type: Tokens.Ident,
                            value: ident()
                        });
                    } else {
                        tokens.push({ type: Tokens.Delim, value: ch });
                    }
                    continue;
                }

                if (ch === '.') {
                    if (is_num()) {
                        reconsume(ch);
                        tokens.push(num());
                    } else {
                        tokens.push({ type: Tokens.Delim, value: ch });
                    }
                    continue;
                }

                if (ch === ':') {
                    tokens.push({ type: Tokens.Colon });
                    continue;
                }

                if (ch === ';') {
                    tokens.push({ type: Tokens.Semicolon });
                    continue;
                }

                if (ch === '@') {
                    if (is_ident()) {
                        tokens.push({
                            type: Tokens.AtKeyword,
                            value: ident()
                        });
                    } else {
                        tokens.push({ type: Tokens.Delim, value: ch });
                    }
                    continue;
                }

                if (ch === '[') {
                    tokens.push({ type: Tokens.BracketOpen });
                    continue;
                }

                if (ch === '\\') {
                    if (!eof() && peek() !== '\n') {
                        reconsume(ch);
                        tokens.push(identlike());
                        continue;
                    }
                    throw new Error('Invalid escape');
                }

                if (ch === ']') {
                    tokens.push({ type: Tokens.BracketClose });
                    continue;
                }

                if (ch === '{') {
                    tokens.push({ type: Tokens.BraceOpen });
                    continue;
                }

                if (ch === '}') {
                    tokens.push({ type: Tokens.BraceClose });
                    continue;
                }

                if (ch.match(/\d/)) {
                    reconsume(ch);
                    tokens.push(num());
                    continue;
                }

                if (ch.match(IdentStartCodePoint)) {
                    reconsume(ch);
                    tokens.push(identlike());
                    continue;
                }

                /*
                    Treat everything not already handled
                    as a delimiter.
                */
                tokens.push({ type: Tokens.Delim, value: ch });
            }

            return tokens;
        };

        const NodeTypes = {
            SelectorList: 'SelectorList',
            ComplexSelector: 'ComplexSelector',
            CompoundSelector: 'CompoundSelector',
            TypeSelector: 'TypeSelector',
            IdSelector: 'IdSelector',
            ClassSelector: 'ClassSelector',
            AttributeSelector: 'AttributeSelector',
            PseudoClassSelector: 'PseudoClassSelector',
            PseudoElementSelector: 'PseudoElementSelector'
        };

        const Syntax = {
            None: 'None',
            SelectorList: 'SelectorList',
            AnPlusB: 'AnPlusB'
        };

        const Syntaxes = {
            ':is': Syntax.SelectorList,
            ':matches': Syntax.SelectorList,
            ':-moz-any': Syntax.SelectorList,
            ':-webkit-any': Syntax.SelectorList,
            ':where': Syntax.SelectorList,
            ':not': Syntax.SelectorList,
            ':has': Syntax.SelectorList,
            ':nth-child': Syntax.AnPlusB,
            ':nth-child-of': Syntax.AnPlusB,
            ':nth-last-child': Syntax.AnPlusB,
            ':nth-of-type': Syntax.AnPlusB,
            ':nth-last-of-type': Syntax.AnPlusB,
            ':nth-col': Syntax.AnPlusB,
            ':nth-last-col': Syntax.AnPlusB
        };

        const parse = (arg, options = {}) => {
            const tokens = typeof arg === 'string' ? tokenize(arg) : arg;

            let tok;

            let microsyntax = {
                ...Syntaxes,
                ...(options.syntaxes || {})
            };

            const delim = (t, ch) => t && t.type === Tokens.Delim && t.value === ch;

            const eoi = () => !tokens.length;
            const next = () => {
                tok = tokens.shift();
            };
            const peek = ch => tokens[ch || 0];

            const WS = () => {
                let ws = false;
                while (tok && tok.type === Tokens.Whitespace) {
                    ws = true;
                    next();
                }
                return ws;
            };

            const TypeSelector = () => {
                let ns = NsPrefix();
                if (tok && (tok.type === Tokens.Ident || delim(tok, '*'))) {
                    let node = {
                        type: NodeTypes.TypeSelector,
                        identifier: tok.value
                    };
                    if (ns !== undefined) {
                        node.namespace = ns;
                    }
                    next();
                    return node;
                }
                return undefined;
            };

            const NsPrefix = () => {
                if (
                    !eoi() &&
                    tok &&
                    (tok.type === Tokens.Ident || delim(tok, '*')) &&
                    delim(peek(), '|')
                ) {
                    let ns = tok.value;
                    next();
                    next();
                    return ns;
                }
                return undefined;
            };

            const SubclassSelector = () => {
                return (
                    IdSelector() ||
                    ClassSelector() ||
                    AttributeSelector() ||
                    PseudoClassSelector()
                );
            };

            const IdSelector = () => {
                if (tok && tok.type === Tokens.Hash) {
                    let ret = {
                        type: NodeTypes.IdSelector,
                        identifier: tok.value
                    };
                    next();
                    return ret;
                }
                return undefined;
            };

            const ClassSelector = () => {
                if (!eoi() && delim(tok, '.') && peek().type === Tokens.Ident) {
                    next();
                    let ret = {
                        type: NodeTypes.ClassSelector,
                        identifier: tok.value
                    };
                    next();
                    return ret;
                }
                return undefined;
            };

            /*
                '[' <wq-name> ']' |
                '[' <wq-name> <attr-matcher> [<string>|<ident>] <attr-modifier>? ']'
            */
            const AttributeSelector = () => {
                if (tok && tok.type === Tokens.BracketOpen) {
                    next(); // consume '['
                    WS();

                    let ns = NsPrefix();
                    if (tok.type !== Tokens.Ident) {
                        throw new Error('Invalid attribute name');
                    }
                    let node = {
                        type: NodeTypes.AttributeSelector,
                        identifier: tok.value
                    };
                    if (ns !== undefined) {
                        node.namespace = ns;
                    }
                    next(); // consume attribute name
                    WS();
                    let matcher = AttrMatcher();
                    if (matcher) {
                        node.matcher = matcher;
                        WS();
                        if (tok.type === Tokens.String || tok.type === Tokens.Ident) {
                            node.value = tok.value;
                            next();
                        } else {
                            throw new Error('Expected attribute value');
                        }
                        WS();
                        let mod = AttrModifier();
                        if (mod) {
                            node.modifier = mod;
                        }
                        WS();
                    }
                    /*
                        Allow unclosed attribute selector
                        if we've reached the end of input
                    */
                    if (!tok) {
                        return node;
                    }
                    if (tok.type === Tokens.BracketClose) {
                        next();
                        return node;
                    }
                    throw new Error('Unclosed attribute selector');
                }
                return undefined;
            };

            const AttrMatcher = () => {
                if (delim(tok, '=')) {
                    let ret = tok.value;
                    next();
                    return ret;
                }
                if (!eoi() && tok && tok.type === Tokens.Delim && delim(peek(), '=')) {
                    let ret = tok.value;
                    next();
                    ret += tok.value;
                    next();
                    return ret;
                }
                return undefined;
            };

            const AttrModifier = () => {
                if (
                    tok &&
                    tok.type === Tokens.Delim &&
                    tok.value &&
                    tok.value.match(/i|s/i)
                ) {
                    let ret = tok.value.toLowerCase();
                    next();
                    return ret;
                }
                return undefined;
            };

            const PseudoElementSelector = () => {
                if (
                    tok &&
                    tok.type === Tokens.Colon &&
                    !eoi() &&
                    peek().type === Tokens.Colon
                ) {
                    next(); // consume first colon
                    let node = PseudoClassSelector(true);
                    node.type = NodeTypes.PseudoElementSelector;
                    return node;
                }
                return undefined;
            };

            const PseudoClassSelector = (is_actually_pseudo_elem = false) => {
                if (!eoi() && tok && tok.type === Tokens.Colon) {
                    if (peek().type === Tokens.Ident || peek().type === Tokens.Function) {
                        next();
                        let node = {
                            type: NodeTypes.PseudoClassSelector,
                            identifier: tok.value
                        };
                        if (tok.type === Tokens.Function) {
                            node.argument = [];
                            let fn_depth = 1;
                            while (!eoi() && fn_depth) {
                                next();
                                if (tok.type === Tokens.ParenClose) {
                                    fn_depth -= 1;
                                } else if (
                                    tok.type === Tokens.Function ||
                                    tok.type === Tokens.ParenOpen
                                ) {
                                    fn_depth += 1;
                                }
                                if (fn_depth > 0) {
                                    node.argument.push(tok);
                                }
                            }

                            let syntax =
                                microsyntax[
                                    (is_actually_pseudo_elem ? '::' : ':') + node.identifier
                                ];
                            if (syntax && syntax !== Syntax.None) {
                                node.argument = Argument(node.argument, syntax);
                            }

                            if (!tok && fn_depth) {
                                throw new Error('Parentheses mismatch');
                            }
                        }
                        next();
                        return node;
                    }
                }
            };

            const Argument = (tokens, syntax = Syntax.None) => {
                if (typeof syntax === 'function') {
                    return syntax(tokens);
                }
                switch (syntax) {
                    case Syntax.SelectorList:
                        return parse(tokens, options);
                    case Syntax.AnPlusB:
                        return AnPlusB(tokens);
                    case Syntax.None:
                        return tokens;
                }
                throw new Error(`Invalid argument syntax ${syntax}`);
            };

            // TODO
            const AnPlusB = tokens => tokens;

            /*
                <compound> = [<type>? <subclass>* [<pseudo-el> <pseudo-class>*]*]!
            */
            const CompoundSelector = () => {
                WS();
                let selectors = [];
                let selector;
                do {
                    // TODO enforce order & other restrictions
                    selector =
                        TypeSelector() ||
                        SubclassSelector() ||
                        PseudoElementSelector() ||
                        PseudoClassSelector();
                    if (selector) {
                        selectors.push(selector);
                    }
                } while (selector);

                if (!selectors.length) {
                    return undefined;
                }
                if (selectors.length > 1) {
                    return {
                        type: NodeTypes.CompoundSelector,
                        selectors
                    };
                }
                return selectors[0];
            };

            const Combinator = () => {
                if (!tok) {
                    return undefined;
                }
                let combinator = WS() ? ' ' : '';
                if (tok && tok.type === Tokens.Delim) {
                    combinator = tok.value;
                    next();
                    WS(); // consume trailing whitespace
                }
                return combinator;
            };

            const ComplexSelector = () => {
                let node, sel, cmb;
                while (tok) {
                    sel = CompoundSelector();
                    if (sel) {
                        if (!node) {
                            node = {
                                type: NodeTypes.ComplexSelector,
                                left: sel
                            };
                        } else if (!node.right) {
                            node.right = sel;
                            node = {
                                type: NodeTypes.ComplexSelector,
                                left: node
                            };
                        }
                    }
                    cmb = Combinator();
                    if (cmb) {
                        if (!node) {
                            // Relative selector
                            node = {
                                type: NodeTypes.ComplexSelector,
                                left: null
                            };
                        }
                        node.combinator = cmb;
                    }

                    // TODO: refactor into something less weird
                    if (!cmb && !sel) {
                        break;
                    }
                }
                if (node && !node.right) {
                    if ((!node.combinator || node.combinator === ' ') && node.left !== null) {
                        return node.left;
                    } else {
                        throw new Error(
                            `Expected selector after combinator ${node.combinator}`
                        );
                    }
                }
                return node;
            };

            let ast = {
                type: NodeTypes.SelectorList,
                selectors: []
            };

            while (!eoi()) {
                next();
                let sel = ComplexSelector();
                if (sel) {
                    ast.selectors.push(sel);
                }
                if (tok && tok.type !== Tokens.Comma) {
                    throw new Error(`Unexpected token ${tok.type}`);
                }
            }

            return ast;
        };

        const closest = (el, sel) => {
            const node = typeof sel === 'string' || Array.isArray(sel) ? parse(sel) : sel;
            let curr = el;
            while (curr && !matches(curr, node)) {
                curr = adapter.closestParent(curr);
            }
            return curr;
        };
        
        const children = (el, sel) => {
            const node = typeof sel === 'string' || Array.isArray(sel) ? parse(sel) : sel;         
            let result = [];
            let it = adapter.visit(
                el,
                n => n !== el && matches(n, node),
                n => { result.push(n); return false },
                1
            );
            return result;
        }

        const matches = (el, sel) => {
            const node = typeof sel === 'string' || Array.isArray(sel) ? parse(sel) : sel;            
            if(node == null)
                return false;
            if (Matchers[node.type]) {
                return Matchers[node.type](el, node);
            }
            throw new Error(`Unsupported node type ${node.type}`);
        };

        const querySelector = (el, sel) => {
            const node = typeof sel === 'string' || Array.isArray(sel) ? parse(sel) : sel;
            var result = null;
            let it = adapter.visit(
                el,
                n => n !== el && matches(n, node),
                n => { result = n; return true; }
            );
            return result;
        };

        const querySelectorAll = (el, sel) => {
            const node = typeof sel === 'string' || Array.isArray(sel) ? parse(sel) : sel;
            let result = [];
            let it = adapter.visit(
                el,
                n => n !== el && matches(n, node),
                n => { result.push(n); return false }
            );
            return result;
        };

        /*
            Match functions
            ---------------
        */

        const matchSelectorList = (el, node) =>
            node.selectors.some(s => matches(el, s));

        // TODO: handle node.left === null (relative selector)
        const matchComplexSelector = (el, node) => {
            if (!matches(el, node.right)) {
                return false;
            }
            switch (node.combinator) {
                case ' ':
                    return adapter.closestParent(el) && closest(adapter.closestParent(el), node.left);
                case '>':
                    return adapter.closestParent(el) && matches(adapter.closestParent(el), node.left);
                case '+':
                    return (
                        adapter.prevSibling(el) &&
                        matches(adapter.prevSibling(el), node.left)
                    );
                case '~': {
                    let ref = el;
                    while ((ref = adapter.prevSibling(ref))) {
                        if (matches(ref, node.left)) {
                            return true;
                        }
                    }
                    return false;
                }
                default:
                    throw new Error(`Unsupported combinator ${node.combinator}`);
            }
        };

        const matchCompoundSelector = (el, node) =>
            node.selectors.every(s => matches(el, s));

        const matchIdSelector = (el, node) => adapter.hasID(el, node.identifier);
        const matchClassSelector = (el, node) => adapter.hasClass(el, node.identifier);

        const matchAttributeSelector = (el, node) => {
            // TODO namespaces
            if (!node.matcher) {
                return adapter.hasAttribute(el, node.identifier);
            }
            let haystack = adapter.getAttribute(el, node.identifier);
            if (!haystack) {
                return false;
            }
            let needle = node.value;
            if (node.modifier !== 's') {
                haystack = haystack.toLowerCase();
                needle = needle.toLowerCase();
            }
            switch (node.matcher) {
                case '=':
                    return haystack === needle;
                case '^=':
                    return haystack.length >= needle.length && haystack.indexOf(needle) === 0;
                case '$=':
                    return (
                        haystack.length >= needle.length &&
                        haystack.indexOf(needle) === haystack.length - needle.length
                    );
                case '*=':
                    return haystack.length >= needle.length && haystack.indexOf(needle) > -1;
                case '~=':
                    return haystack.split(/\s+/).some(part => part === needle);
                case '|=':
                    return haystack === needle || haystack.indexOf(needle + '-') === 0;
                default:
                    throw new Error(`Unsupported attribute matcher ${node.matcher}`);
            }
        };

        function isValidArg(args, ...types) {
            if(!Array.isArray(args)) args = [args];
            if (!args && args.length != types.length) {
            return false;
            }
            for(var i = 0; i < args.length; i++) {
                if (args[i].type !== types[i]) {
                    throw new Error('Expected a ' + types[i] + ' argument');
                }
            }
            return true;
        }
        
        /*
            Matches the element `el` against a `node`
            of type PseudoClassSelector.
        */
        const matchPseudoClassSelector = (el, node) => {
            switch (node.identifier) {
                /*
                    Logical Combinations

                    TODO: make them permissive towards invalid selectors
                */
                case 'is':
                case 'where':
                case 'matches':
                case '-moz-any':
                case '-webkit-any':
                    // TODO is this correct?
                    if (!node.argument) {
                        return false;
                    }
                    if (node.argument.type !== NodeTypes.SelectorList) {
                        throw new Error('Expected a SelectionList argument');
                    }
                    return node.argument.selectors.some(s => matches(el, s));
                case 'not':
                    // TODO is this correct?
                    if (!node.argument) {
                        return true;
                    }
                    if (node.argument.type !== NodeTypes.SelectorList) {
                        throw new Error('Expected a SelectionList argument');
                    }
                    return node.argument.selectors.every(s => !matches(el, s));
                case 'has':
                    // TODO is this correct?
                    if (!node.argument) {
                        return false;
                    }
                    if (node.argument.type !== NodeTypes.SelectorList) {
                        throw new Error('Expected a SelectionList argument');
                    }
                    // TODO handle :scope
                    return !!querySelector(el, node.argument);

                /*
                    Tree-Structural pseudo-classes
                */

                case 'first-child':
                    return previous(el) === 0;
                case 'first-of-type':
                    return firstOfType(el);
                case 'last-child':
                    return next(el) === 0;
                case 'last-of-type':
                    return lastOfType(el);
                case 'only-child':
                    return !next(el) && !previous(el);
                case 'only-of-type':
                    return firstOfType(el) && lastOfType(el);

                case 'root':
                    return adapter.isRoot(el);

                case 'empty':
                    return adapter.isEmpty(el);

                /*
                    Input Pseudo-classes
                    See also: https://html.spec.whatwg.org/multipage/semantics-other.html#pseudo-classes
                */
                case 'enabled':
                    return !adapter.getAttribute(el, 'disabled');
                case 'disabled':
                    return adapter.getAttribute(el, 'disabled');
                case 'link':
                    return (
                        (adapter.getName(el) === 'a' ||
                            adapter.getName(el) === 'area' ||
                            adapter.getName(el) === 'link') &&
                        adapter.hasAttribute(el, 'href')
                    );
                case 'visited':
                    return false;
                case 'checked':
                    return adapter.getAttribute(el, 'checked') || adapter.getAttribute(el, 'selected');
                case 'indeterminate':
                    return adapter.getAttribute(el, 'indeterminate');

                case 'nth-child':
                    return isValidArg(node.argument, 'number') ? childIndex(el) == node.argument[0].value : false;

                case 'nth-child-of':
                    return isValidArg(node.argument, 'number') ? childIndex(el, true) == node.argument[0].value : false;
                    
                // TODO
                case 'default':
                case 'defined':
                case 'active':
                case 'hover':
                case 'focus':
                case 'target':
                case 'nth-of-type':
                case 'nth-last-child':
                case 'nth-last-of-type':
                case 'scope':
                default:
                    throw new Error(`Pseudo-class ${node.identifier} not implemented yet`);
            }
        };

        const matchPseudoElementSelector = () => {
            throw new Error('Pseudo-elements are not supported.');
        };

        const matchTypeSelector = (el, node) => {
            if (node.identifier !== '*' && adapter.getName(el) !== node.identifier) {
                return false;
            }
            if (node.namespace === undefined || node.namespace === '*') {
                return true;
            }
            if (node.namespace === '' && adapter.getNS(el) === null) {
                return true;
            }
            return adapter.getNS(el) === node.namespace;
        };

        const previous = el => {
            let count = 0,
                ref = el;
            while ((ref = adapter.prevSibling(ref))) count++;
            return count;
        };

        const next = el => {
            let count = 0,
                ref = el;
            while ((ref = adapter.nextSibling(ref))) count++;
            return count;
        };
        
        const childIndex = (el, ty) => {
            return adapter.getChildIndex(el, ty);
        };

        const firstOfType = el => {
            let ref = el;
            while ((ref = adapter.prevSibling(ref))) {
                if (adapter.getName(ref) === adapter.getName(el) && adapter.getNS(ref) === adapter.getNS(el)) {
                    return false;
                }
            }
            return true;
        };

        const lastOfType = el => {
            let ref = el;
            while ((ref = adapter.nextSibling(ref))) {
                if (adapter.getName(ref) === adapter.getName(el) && adapter.getNS(ref) === adapter.getNS(el)) {
                    return false;
                }
            }
            return true;
        };

        const Matchers = {
            [NodeTypes.SelectorList]: matchSelectorList,
            [NodeTypes.ComplexSelector]: matchComplexSelector,
            [NodeTypes.CompoundSelector]: matchCompoundSelector,
            [NodeTypes.TypeSelector]: matchTypeSelector,
            [NodeTypes.IdSelector]: matchIdSelector,
            [NodeTypes.ClassSelector]: matchClassSelector,
            [NodeTypes.AttributeSelector]: matchAttributeSelector,
            [NodeTypes.PseudoClassSelector]: matchPseudoClassSelector,
            [NodeTypes.PseudoElementSelector]: matchPseudoElementSelector
        };
        
        const walk = (ast, arg) => {
            let queue = [ast];
            let node;
            while (queue.length) {
                node = queue.shift();
                if (typeof arg === 'function') {
                    arg(node);
                } else if (arg[node.type]) {
                    arg[node.type](node);
                }
                switch (node.type) {
                    case NodeTypes.SelectorList:
                    case NodeTypes.CompoundSelector:
                        if (node.selectors) {
                            queue = queue.concat(node.selectors);
                        }
                        break;
                    case NodeTypes.ComplexSelector:
                        if (node.left) {
                            queue.push(node.left);
                        }
                        if (node.right) {
                            queue.push(node.right);
                        }
                        break;
                    case NodeTypes.PseudoClassSelector:
                    case NodeTypes.PseudoElementSelector:
                        if (
                            typeof node.argument === 'object' &&
                            !Array.isArray(node.argument)
                        ) {
                            queue.push(node.argument);
                        }
                }
            }
        };
        
        const serialize = (node, extra) => {
            if (Array.isArray(node)) {
                return node.map(serializeToken).join('');
            }

            let out;
            switch (node.type) {
                case NodeTypes.SelectorList:
                    return node.selectors.map(s => serialize(s, extra)).join(', ');
                case NodeTypes.ComplexSelector:
                    out = node.left === null ? '' : serialize(node.left, extra);
                    if (node.combinator === ' ') {
                        out += ' ';
                    } else {
                        out += (node.left === null ? '' : ' ') + node.combinator + ' ';
                    }
                    return out + serialize(node.right, extra);
                case NodeTypes.CompoundSelector:
                    return node.selectors.map(s => serialize(s, extra)).join('');
                case NodeTypes.TypeSelector:
                    return (
                        (node.namespace === undefined ? '' : node.namespace + '|') +
                        node.identifier
                    );
                case NodeTypes.IdSelector:
                    return '#' + node.identifier;
                case NodeTypes.ClassSelector:
                    return '.' + node.identifier;
                case NodeTypes.AttributeSelector:
                    out = '[' + node.identifier;
                    if (node.matcher) {
                        out += node.matcher;
                        // TODO: this serializes Idents as Strings, is that okay?
                        out += `"${node.value.replace(/"/g, '\\"')}"`;
                        if (node.modifier) {
                            out += ' ' + node.modifier;
                        }
                    }
                    return out + ']';
                case NodeTypes.PseudoClassSelector:
                    out = ':' + node.identifier;
                    if (node.argument !== undefined) {
                        out += '(' + serialize(node.argument, extra) + ')';
                    }
                    return out;
                case NodeTypes.PseudoElementSelector:
                    out = '::' + node.identifier;
                    if (node.argument !== undefined) {
                        out += '(' + serialize(node.argument, extra) + ')';
                    }
                    return out;
            }

            if (typeof extra === 'function') {
                return extra(node, extra);
            }

            if (extra && typeof extra[node.type] === 'function') {
                return extra[node.type](node, extra);
            }

            throw new Error(`Unknown node type ${node.type}`);
        };

        const serializeToken = tok => {
            switch (tok.type) {
                case Tokens.Ident:
                    return tok.value;
                case Tokens.Function:
                    return tok.value + '(';
                case Tokens.AtKeyword:
                    return '@' + tok.value;
                case Tokens.Hash:
                    return '#' + tok.value;
                case Tokens.String:
                    return `"${tok.value.replace(/"/g, '\\"')}"`;
                case Tokens.Dimension:
                    return tok.value + tok.unit;
                case Tokens.Number:
                case Tokens.Delim:
                    return tok.value;
                case Tokens.Whitespace:
                    return ' ';
                case Tokens.Colon:
                    return ':';
                case Tokens.Semicolon:
                    return ';';
                case Tokens.Comma:
                    return ',';
                case Tokens.BracketOpen:
                    return '[';
                case Tokens.BracketClose:
                    return ']';
                case Tokens.ParenOpen:
                    return '(';
                case Tokens.ParenClose:
                    return ')';
                case Tokens.BraceOpen:
                    return '{';
                case Tokens.BraceClose:
                    return '}';
            }
            throw new Error(`Unknown token type ${tok.type}`);
        };
        return {
            querySelector:querySelector,
            querySelectorAll:querySelectorAll,
            closest:closest,
            children:children,
            matches:matches
        }
    }
})((window.cssqry = {}));

cssqry.dom = cssqry.init({
    closestParent(el) {
        return el.parentNode;
    },
    prevSibling(el) {
        return el.previousElementSibling;
    },
    nextSibling(el) {
        return el.nextElementSibling;
    },
    getChildIndex(el, ty) {
        return !ty ? Array.prototype.indexOf.call(el.parentNode.children, el) :
                            Array.prototype.filter.call(el.parentNode.children, (n) => n.localName == el.localName).indexOf(el);
    },
    hasAttribute(el, attr) {
        return el.hasAttribute(attr);
    },
    getAttribute(el, attr) {
        return el.getAttribute(attr);
    },
    hasID(el, id) {
        return el.id === id;
    },
    hasClass(el, cls) {
        return el.classList.contains(cls);
    },
    getNS(el) {
        return el.prefix;
    },
    getName(el) {
        return el.localName;
    },
    isRoot(el) {
        return el === (el.ownerDocument || el).documentElement;
    },
    isEmpty(el) {
        return (
                    !el.childNodes.length ||
                    (el.childNodes.length === 1 &&
                        el.childNodes[0].nodeType === 3 &&
                        el.childNodes[0].nodeValue.match(/^\s*$/))
                );
    },
    visit(el, filter, onNext) {
        let it = (el.ownerDocument || el).createNodeIterator(
            el,
            1,
            filter
        );
        var n;
        while ((n = it.nextNode()) && !onNext(n))
            ;
    }
});

cssqry.ast = cssqry.init({
    closestParent(el) {
        return el.parent;
    },
    prevSibling(el) {
        var prev = null;
        var first = true;
        function onNext(n) {
            if(n === el)
                return true;
            if(!first) {
                prev = el;
            } else {
                first = false;
            }
            return false;
        }
        el.parent.visit({
            onComment(val, idx) { },
            onNode(node, pos) { return pos == 0 ? onNext(node) : false; },
            onLiteral(val) { return false; },
            onVal(val) { return false; }
        }, 1);
        return prev;
    },
    nextSibling(el) {
        var found = false;
        var next = null;
        var first = true;
        function onNext(n) {
            if(found) {
                next = n;
                return true;
            }
            if(!first) {
                if(n === el) 
                    found = true;
            } else {
                first = false;
            }
            return false;
        }
        el.parent.visit({
            onComment(val, idx) { },
            onNode(node, pos) { return pos == 0 ? onNext(node) : false; },
            onLiteral(val) { return false; },
            onVal(val) { return false; }
        }, 1);
        return next;
    },
    getChildIndex(el, ty) {
        var index = -1;
        var _index = -1;
        function onNext(n) {
            if(n === el) {
                index = _index;
                return true;
            }
            if(_index == -1 || !ty || el.constructor.name == n.constructor.name)
                _index += 1;
            return false;
        }
        el.parent.visit({
            onComment(val, idx) { },
            onNode(node, pos) { return pos == 0 ? onNext(node) : false; },
            onLiteral(val) { return false; },
            onVal(val) { return false; }
        }, 1);
        return index;
    },
    hasAttribute(el, attr) {
        return el.hasOwnProperty(attr);
    },
    getAttribute(el, attr) {
        if(el.hasOwnProperty(attr))
            return el[attr];
        return null;
    },
    hasID(el, id) {
        return false;
    },
    hasClass(el, cls) {
        return false;
    },
    getNS(el) {
        return null;
    },
    getName(el) {
        return el.constructor.name;
    },
    isRoot(el) {
        return el.parent === null;
    },
    isEmpty(el) {
        var empty = true;
        if(el.visit) {
            el.visit({
                onComment(val, idx) { },
                onNode(node, pos) { empty = false; return true; },
                onLiteral(val) { empty = false; return true; },
                onVal(val) { empty = false; return true; }
            }, 1);
        } else {
            empty = (el == '');
        }
        return empty;
    },
    visit(el, filter, onNext) {
        if(el.visit) {
            el.visit({
                onComment(val, idx) { },
                onNode(node, pos) { return pos == 0 && filter(node) ? onNext(node) : false; },
                onLiteral(val) { return false; },
                onVal(val) { return false; }
            });
        } else {
            if(filter(el))
                onNext(el);
        }
    }
});

function _InitNode() {
    Node.prototype.query = function(q) { return cssqry.ast.querySelector(this, q); };
    Node.prototype.queryAll = function(q) { return cssqry.ast.querySelectorAll(this, q); };
    Node.prototype.closest = function(q) { return cssqry.ast.closest(this, q); };
    Node.prototype.name = function(q) { return this.constructor.name; };
    Node.prototype.matches = function(q) { return cssqry.ast.matches(this, q); };
    Node.prototype.children = function(q) { return cssqry.ast.children(this, q); };
    Node.prototype.text = function() {
            var res = '';
            var first = true;
            this.visit({
                onComment(val, idx) { },
                onNode(node, pos) {
                    if(!first) {
                        if(pos == 0)  res += node.constructor.name; 
                    } else {
                        first = false;
                    }
                },
                onLiteral(val) { return res += val; },
                onVal(val) { return res += val; }
            });
            return res;
    };
    Node.prototype.forEach = function(f, depth = 1) { 
            var first = true;
            this.visit({
                onComment(val, idx) { },
                onNode(node, pos) { 
                    if(!first) {
                        return pos == 0 ? f(node, 0) : false;
                    } else {
                        first = false;
                    }
                },
                onLiteral(val) { return f(val, 1); },
                onVal(val) { return f(val, 2); }
            }, depth);
    };
    
}
