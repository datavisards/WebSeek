import htmlclean from 'htmlclean';

// Convert column index to Excel-style letters (0 -> A, 1-> B, etc.)
export const indexToLetters = (index: number): string => {
    let letters = '';
    do {
        letters = String.fromCharCode(65 + (index % 26)) + letters;
        index = Math.floor(index / 26) - 1;
    } while (index >= 0);
    return letters;
};

export const cleanHTML = (html: string): string => {
    return htmlclean(html, {
        protect: /<body.*?<\/body>/gs,
        unprotect: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Remove scripts
        // Keep <svg> tags but remove their inner content
        svg: /<svg\b[^>]*>(.*?)<\/svg>/gi,
        svgReplacement: '<svg$1></svg>'
    });
};

export default { indexToLetters, cleanHTML };