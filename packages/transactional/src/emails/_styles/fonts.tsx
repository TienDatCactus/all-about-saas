import { Font } from 'react-email';
import * as React from 'react';

export function EmailFonts() {
  return (
    <>
      <Font
        fontFamily="Figtree"
        fallbackFontFamily="sans-serif"
        webFont={{
          url: 'https://fonts.gstatic.com/s/figtree/v6/w5F1zDqG7TQdvKC2Qd-2Puhq.woff2',
          format: 'woff2',
        }}
        fontWeight={400}
        fontStyle="normal"
      />
      <Font
        fontFamily="Figtree"
        fallbackFontFamily="sans-serif"
        webFont={{
          url: 'https://fonts.gstatic.com/s/figtree/v6/w5F1zDqG7TQdvKC2Qd-3Puhq.woff2',
          format: 'woff2',
        }}
        fontWeight={600}
        fontStyle="normal"
      />
    </>
  );
}
