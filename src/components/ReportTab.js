import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { marked } from 'marked';
import Handlebars from 'handlebars';
import ReactJson from '@microlink/react-json-view';
import styles from './ReportTab.module.css';

const ReportTab = ({ templateData }) => {
  const [markdownTemplate, setMarkdownTemplate] = useState('');
  const [previewContent, setPreviewContent] = useState('');

  // Load template and register helpers
  useEffect(() => {
    // Register a Handlebars helper for math operations
    Handlebars.registerHelper('math', function(lvalue, operator, rvalue) {
      lvalue = parseFloat(lvalue);
      rvalue = parseFloat(rvalue);
            
      return {
        "+": lvalue + rvalue,
        "-": lvalue - rvalue,
        "*": lvalue * rvalue,
        "/": lvalue / rvalue,
        "%": lvalue % rvalue
      }[operator];
    });

    // Load markdown template
    fetch('/report-template.md')
      .then(response => response.text())
      .then(template => {
        setMarkdownTemplate(template);
      })
      .catch(error => {
        console.error('Error loading template:', error);
        setPreviewContent('<p style="color: red">Error loading template</p>');
      });
  }, []);

  useEffect(() => {
    // Update preview whenever template or data changes
    if (!markdownTemplate) return;

    try {
      const template = Handlebars.compile(markdownTemplate);
      const renderedMarkdown = template(templateData);
      const htmlContent = marked.parse(renderedMarkdown);
      setPreviewContent(htmlContent);
    } catch (error) {
      console.error('Error rendering template:', error);
      setPreviewContent(`<p style="color: red">Error rendering template: ${error.message}</p>`);
    }
  }, [markdownTemplate, templateData]);

  const handleTemplateChange = (value) => {
    setMarkdownTemplate(value);
  };

  return (
    <div className={styles['report-container']}>
      {/* Template Data Row */}
      <div className={styles['editor-row']}>
        <div className={styles['editor-container']}>
          <div className={styles['editor-label']}>Template Data</div>
          <div 
            style={{
              background: '#282c34',
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '10px',
              marginBottom: '10px',
              overflow: 'auto',
              height: 'calc(100% - 40px)'
            }}
          >
            <ReactJson 
              src={templateData}
              theme="monokai"
              name={null}
              collapsed={1}
              enableClipboard={true}
              displayDataTypes={false}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>
        </div>
      </div>

      {/* Template Editor Row */}
      <div className={styles['template-editor-row']}>
        <div className={styles['editor-container']}>
          <div className={styles['editor-label']}>Markdown Template</div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CodeMirror
              value={markdownTemplate}
              height="100%"
              extensions={[markdown()]}
              onChange={handleTemplateChange}
              theme="dark"
              style={{ fontSize: '14px' }}
            />
          </div>
        </div>
      </div>

      {/* Preview Row */}
      <div className={styles['preview-row']}>
        <div className={styles['editor-container']}>
          <div className={styles['editor-label']}>Report Preview</div>
          <div className={styles['report-preview']}>
            <div 
              className={styles['preview-content']}
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportTab; 