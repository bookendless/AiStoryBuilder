import React, { useMemo } from 'react';
import { parseRubySegments } from '../../utils/rubyUtils';

interface RubyTextProps {
  text: string;
}

/**
 * ルビ・傍点記法（｜親文字《るび》・漢字《かんじ》・《《傍点》》）を
 * <ruby> 要素と圏点スタイルで描画するコンポーネント。
 * 縦書き（writing-mode: vertical-rl）でもブラウザ標準のルビ配置が適用される。
 */
export const RubyText: React.FC<RubyTextProps> = ({ text }) => {
  const segments = useMemo(() => parseRubySegments(text), [text]);

  return (
    <>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'ruby':
            return (
              <ruby key={index}>
                {segment.base}
                <rt>{segment.ruby}</rt>
              </ruby>
            );
          case 'emphasis':
            return (
              <span
                key={index}
                style={{
                  textEmphasis: 'filled sesame',
                  WebkitTextEmphasis: 'filled sesame',
                } as React.CSSProperties}
              >
                {segment.content}
              </span>
            );
          default:
            return <React.Fragment key={index}>{segment.content}</React.Fragment>;
        }
      })}
    </>
  );
};
