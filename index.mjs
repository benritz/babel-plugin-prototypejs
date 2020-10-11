export default function({ types: t }) {
    return {
        visitor: {
            MemberExpression(path) {
                // translate bindAsEventListener() to bind()
                if (path.node.property.name === "bindAsEventListener") {
                    path.node.property.name = "bind";
                }

                // translate each() to forEach()
                if (path.node.property.name === "each") {
                    path.node.property.name = "forEach";
                }

                // if (path.node.property.name === "observe") {
                //     path.node.property.name = "addEventListener";
                // }

                // translate addClassName(), removeClassName() and hasClassName() to classList methods
                let classListMethod;
                switch (path.node.property.name) {
                    case "addClassName":
                        classListMethod = "add";
                        break;
                    case "removeClassName":
                        classListMethod = "remove";
                        break;
                    case "hasClassName":
                        classListMethod = "contains";
                        break;
                }

                if (classListMethod) {
                    path.node.object =  { type: "MemberExpression", object: path.node.object, property: { type: "Identifier", name: "classList" } };
                    path.node.property = { type: "Identifier", name: classListMethod };
                }
            },

            Identifier(path) {
                if (path.node.name === "$super") {
                    const funcNode = path.getFunctionParent().node;

                    if (funcNode.type === "ClassMethod") {
                        const methodName = funcNode.key.name;

                        delete path.node.name;

                        if (methodName === "constructor") {
                            path.node.type = "Super";
                        } else {
                            path.node.type = "MemberExpression";
                            path.node.object = { type: "Super" };
                            path.node.property = { type: "Identifier", name: methodName };
                        }
                    }
                }
            },

            CallExpression(path) {
                // translate $super() to super()
                // translate $() to document.getElementById()
                if (t.isIdentifier(path.node.callee)) {
                    if (path.node.callee.name === "$") {
                        path.node.callee.name = "document.getElementById";
                    }
                }

                // translate Class.create() call expressions to class expressions
                if (t.isMemberExpression(path.node.callee)) {
                    const { object, property } = path.node.callee;

                    if (object && property && object.name === "Class" && property.name === "create") {
                        const args = path.node.arguments;

                        let derivedClass, properties = [];

                        if (args.length === 1) {
                            // non-derived class
                            const arg = args[0];

                            if (arg.type === "ObjectExpression") {
                                properties = arg.properties;
                            }
                        } else if (args.length === 2) {
                            // derived class
                            const arg1 = args[0];
                            const arg2 = args[1];

                            if (arg1.type === "Identifier") {
                                derivedClass = arg1.name;
                            }
                            if (arg2.type === "ObjectExpression") {
                                properties = arg2.properties;
                            }
                        }

                        const mapMethodName = (identifier) => {
                            if (identifier.name === "initialize") {
                                return { type: "Identifier", name: "constructor" };
                            }

                            return identifier;
                        };

                        const methods = properties
                            .filter((objProp) => t.isFunctionExpression(objProp.value))
                            .map((objProp) => ({
                                type: "ClassMethod",
                                key: mapMethodName(objProp.key),
                                kind: "method",
                                params: Array.isArray(objProp.value.params) ? objProp.value.params.filter((param) => param.name !== "$super") : null,
                                body: objProp.value.body,
                                static: false,
                                computed: false,
                                generator: false,
                                expression: false,
                                async: false,
                                leadingComments: objProp.leadingComments
                            }));

                        path.node.type = "ClassDeclaration";
                        path.node.id = null;
                        path.node.superClass = derivedClass ? { type: "Identifier", name: derivedClass } : null;
                        path.node.body = { type: "ClassBody", body: methods };
                    }
                }
            },
        }
    };
}