// Notion 문단 배열 렌더링: null = 문단 구분, 배열 = rich_text, 문자열 = 하위 호환
export default function RichParagraphs({ paragraphs }) {
  return paragraphs.map((paragraph, idx) => {
    if (paragraph === null) {
      return <div key={idx} className="artwork-detail-paragraph-break"></div>;
    }

    if (Array.isArray(paragraph)) {
      return (
        <p key={idx} className="artwork-detail-paragraph">
          {paragraph.map((textItem, textIdx) => {
            const text = textItem.plain_text || '';
            if (textItem.annotations?.bold) {
              return <strong key={textIdx}>{text}</strong>;
            }
            return text;
          })}
        </p>
      );
    }

    return <p key={idx} className="artwork-detail-paragraph">{paragraph}</p>;
  });
}
