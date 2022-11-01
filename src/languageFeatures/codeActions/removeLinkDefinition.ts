/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as lsp from 'vscode-languageserver-types';
import * as nls from 'vscode-nls';
import { makeRange, rangeIntersects } from '../../types/range';
import { getDocUri, ITextDocument } from '../../types/textDocument';
import { WorkspaceEditBuilder } from '../../util/editBuilder';
import { DiagnosticCode } from '../diagnostics';
import { MdLinkDefinition } from '../documentLinks';
import { codeActionKindContains } from './util';

const localize = nls.loadMessageBundle();

export class MdRemoveLinkDefinitionCodeActionProvider {

	private static readonly _removeUnusedDefTitle = localize('removeUnusedTitle', 'Remove unused link definition');
	private static readonly _removeDuplicateDefTitle = localize('removeDuplicateTitle', 'Remove duplicate link definition');

	*getActions(doc: ITextDocument, range: lsp.Range, context: lsp.CodeActionContext): Iterable<lsp.CodeAction> {
		if (!this._isEnabled(context)) {
			return;
		}

		const unusedDiagnosticLines = new Set<number>();

		for (const diag of context.diagnostics) {
			if (diag.code === DiagnosticCode.link_unusedDefinition && diag.data && rangeIntersects(diag.range, range)) {
				const link = diag.data as MdLinkDefinition;
				yield this._getRemoveDefinitionAction(doc, link, MdRemoveLinkDefinitionCodeActionProvider._removeUnusedDefTitle);
				unusedDiagnosticLines.add(link.source.range.start.line);
			}
		}

		for (const diag of context.diagnostics) {
			if (diag.code === DiagnosticCode.link_duplicateDefinition && diag.data && rangeIntersects(diag.range, range)) {
				const link = diag.data as MdLinkDefinition;
				if (!unusedDiagnosticLines.has(link.source.range.start.line)) {
					yield this._getRemoveDefinitionAction(doc, link, MdRemoveLinkDefinitionCodeActionProvider._removeDuplicateDefTitle);
				}
			}
		}
	}

	private _isEnabled(context: lsp.CodeActionContext): boolean {
		if (typeof context.only === 'undefined') {
			return true;
		}

		return context.only.some(kind => codeActionKindContains(lsp.CodeActionKind.QuickFix, kind));
	}

	private _getRemoveDefinitionAction(doc: ITextDocument, definition: MdLinkDefinition, title: string): lsp.CodeAction {
		const builder = new WorkspaceEditBuilder();

		const range = definition.source.range;
		builder.replace(getDocUri(doc), makeRange(range.start.line, 0, range.start.line + 1, 0), '');

		return { title, kind: lsp.CodeActionKind.QuickFix, edit: builder.renameFragment() };
	}
}
