'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table as TableIcon,
  Undo,
  Redo,
  RemoveFormatting,
} from 'lucide-react';

interface RichDocumentEditorProps {
  contentHtml: string;
  onChange: (html: string) => void;
  minHeight?: string;
  className?: string;
}

export const RichDocumentEditor: React.FC<RichDocumentEditorProps> = ({
  contentHtml,
  onChange,
  minHeight = '600px',
  className = '',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  // Sync external HTML into editor when not focused or changed externally
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== contentHtml) {
        editorRef.current.innerHTML = contentHtml || '<p><br></p>';
      }
    }
    isInternalChange.current = false;
  }, [contentHtml]);

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true;
      const html = editorRef.current.innerHTML;
      onChange(html);
      updateActiveFormats();
    }
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (typeof document !== 'undefined') {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      handleInput();
    }
  };

  const updateActiveFormats = () => {
    if (typeof document === 'undefined') return;
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
    });
  };

  const insertTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: bold;">Item / Scope</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: bold;">Qty / Units</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; font-weight: bold;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Software License & Implementation</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;">1 Unit</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right;">₹0.00</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Annual Maintenance & Support</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center;">1 Year</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right;">₹0.00</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    executeCommand('insertHTML', tableHtml);
  };

  return (
    <div className={`flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden ${className}`}>
      {/* Rich Formatting Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center gap-1 text-slate-700 sticky top-0 z-10 select-none">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('undo')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('redo')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h1>')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 font-bold transition-colors"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h2>')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 font-bold transition-colors"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h3>')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 font-bold transition-colors"
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<p>')}
            className="px-2 py-1 text-xs rounded hover:bg-slate-200 text-slate-700 font-medium transition-colors"
            title="Paragraph"
          >
            Paragraph
          </button>
        </div>

        {/* Text Style */}
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.bold ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.italic ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('underline')}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.underline ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('strikeThrough')}
            className={`p-1.5 rounded transition-colors ${
              activeFormats.strikeThrough ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('justifyLeft')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyCenter')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyRight')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyFull')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>

        {/* Lists & Tables */}
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={insertTable}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors"
            title="Insert Pricing / Commercial Table"
          >
            <TableIcon className="w-4 h-4" />
            <span className="text-[11px] font-semibold">Table</span>
          </button>
        </div>

        {/* Clear Formatting */}
        <div>
          <button
            type="button"
            onClick={() => executeCommand('removeFormat')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition-colors"
            title="Clear Formatting"
          >
            <RemoveFormatting className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editable Canvas */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        style={{ minHeight }}
        className="p-8 outline-none text-slate-800 text-sm leading-relaxed overflow-y-auto font-sans focus:ring-0 quotation-editable-content"
      />
    </div>
  );
};
