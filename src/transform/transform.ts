/* eslint-disable @typescript-eslint/naming-convention */
import {parse} from "@babel/parser";
import * as vscode from 'vscode';
import template from "@babel/template";
import traverse, { NodePath } from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import * as Path from 'path';

var firstInstanceSt:{line:number,column:number}[] = [];
var firstInstanceEnd:{line:number,column:number}[] = [];
var repInstanceSt:{line:number,column:number}[] = [];
var repInstanceEnd:{line:number,column:number}[] = [];

// Convert Normal function to Arrow function
export function transformToArrow(code: string): string {
    const ast = parse(code);
    traverse(ast, {
        FunctionDeclaration(path) {
            path.replaceWith(toArrowFunction(path.node));
        }
    });
    return generate(ast).code;
}
 
function toArrowFunction(node: t.FunctionDeclaration): t.VariableDeclaration {
    const name = node.id ? node.id.name : "converted";
    const identifier = t.identifier(name);
    const arrowFuncExp = t.arrowFunctionExpression(
        node.params,
        node.body,
        node.async
    );
    const declarator = t.variableDeclarator(identifier, arrowFuncExp);
    return t.variableDeclaration("const", [declarator]);
}

// detect clone
export function detectClone(code: string, code2: string): string {

    const ast = parse(code);
    const ast2 = parse(code2);
    traverse(ast, {
        FunctionDeclaration(path1) {
            traverse(ast2, {
                FunctionDeclaration(path2){
                    if(path1.node!==path2.node){
                        const ast1 = parse((generate(parse(path1.toString()))).code);
                        const ast2 = parse((generate(parse(path2.toString()))).code);
                        if(path1.node.loc && path2.node.loc){
                            compareAst(ast1, ast2, path1.node.loc, path2.node.loc);
                        }
                    }
                }
            });
        }
    });
    
    // traverse(ast, {
    //     IfStatement(path1) {
    //         traverse(ast, {
    //             IfStatement(path2){
    //                 if(path1.node!==path2.node){
    //                     const ast1 = parse((generate(parse(path1.toString()))).code);
    //                     const ast2 = parse((generate(parse(path2.toString()))).code);
    //                     if(path1.node.loc && path2.node.loc){
    //                         compareAst(ast1, ast2, path1.node.loc, path2.node.loc);
    //                     }
    //                 }
    //             }
    //         });
    //     }
    // });

    // traverse(ast, {
    //     VariableDeclaration(path1) {
    //         traverse(ast, {
    //             VariableDeclaration(path2){
    //                 if(path1.node!==path2.node){
    //                     const ast1 = parse((generate(parse(path1.toString()))).code);
    //                     const ast2 = parse((generate(parse(path2.toString()))).code);
    //                     if(path1.node.loc && path2.node.loc){
    //                         compareAst(ast1, ast2, path1.node.loc, path2.node.loc);
    //                     }
    //                 }
    //             }
    //         });
    //     }
    // });

    // traverse(ast, {
    //     BlockStatement(path1) {
    //         traverse(ast, {
    //             BlockStatement(path2){
    //                 if(path1.node!==path2.node){
    //                     const ast1 = parse((generate(parse(path1.toString()))).code);
    //                     const ast2 = parse((generate(parse(path2.toString()))).code);
    //                     if(path1.node.loc && path2.node.loc){
    //                         compareAst(ast1, ast2, path1.node.loc, path2.node.loc);
    //                     }
    //                 }
    //             }
    //         });
    //     }
    // });
    return generate(ast).code;
}

function compareAst(ast1: t.File, ast2: t.File, loc1: t.SourceLocation, loc2: t.SourceLocation): void {
    traverse(ast1, {
        Identifier(path) {
            path.node.name = "a";
        }
    });
    traverse(ast2, {
        Identifier(path) {
            path.node.name = "a";
        }
    });
    // console.log(generate(ast1).code === generate(ast2).code);
    // console.log(path1.node.loc?.start)
    if(generate(ast1).code === generate(ast2).code){
        firstInstanceSt.push(loc1 ? { line : loc1.start.line,column : loc1.start.column}:{line:0,column:0});
        firstInstanceEnd.push(loc1 ? {line : loc1.end.line,column : loc1.end.column}:{line:0,column:0});
        repInstanceSt.push(loc2 ? {line : loc2.start.line,column : loc2.start.column}:{line:0,column:0});
        repInstanceEnd.push(loc2 ? {line : loc2.end.line,column : loc2.end.column}:{line:0,column:0});
        // console.log(`Clone detected at lines ${path1.node.loc ? path1.node.loc.start.line:""}:${path1.node.loc ? path1.node.loc.end.line:""} and ${path2.node.loc ? path2.node.loc.start.line:""}:${path2.node.loc ? path2.node.loc.end.line:""}`);
        vscode.window.showInformationMessage(`Structurally similar code detected at lines ${loc1 ? loc1.start.line:""}:${loc1 ? loc1.end.line:""} and ${loc2 ? loc2.start.line:""}:${loc2 ? loc2.end.line:""}`);
    }
}

export function updateDiags(document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection): void {
        let diagnostics: vscode.Diagnostic[] = [];
        firstInstanceSt.forEach((instance,index) =>{
            let diag1 = new vscode.Diagnostic(
                new vscode.Range(
                    new vscode.Position(instance.line,instance.column), new vscode.Position(firstInstanceEnd[index].line,firstInstanceEnd[index].column),
                ),
                'WET Code detected!',
                vscode.DiagnosticSeverity.Warning,
            );
            diag1.source = 'DryCo';

            diag1.relatedInformation = [new vscode.DiagnosticRelatedInformation(
                new vscode.Location(document.uri,
                    new vscode.Range( new vscode.Position(repInstanceSt[index].line,repInstanceSt[index].column),  new vscode.Position(repInstanceEnd[index].line,repInstanceEnd[index].column))),
                'Similar Code here')];
            diag1.code = 102;
            diagnostics.push(diag1);
            if (document && Path.basename(document.uri.fsPath)) {
                collection.set(document.uri, diagnostics);
            } else {
                collection.clear();
            }
            // console.log(diag1);
        });
}

// const diag_coll = vscode.languages.createDiagnosticCollection('basic-lint-1');
//     if (vscode.window.activeTextEditor) {
//         diag.updateDiags(vscode.window.activeTextEditor.document, diag_coll);
//     }
//     context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(
//         (e: vscode.TextEditor | undefined) => {
//             if (e !== undefined) {
//                 diag.updateDiags(e.document, diag_coll);
//             }
//         }));