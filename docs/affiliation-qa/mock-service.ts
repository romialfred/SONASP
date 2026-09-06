export const affiliationService = {
  signedFile: async (path: string) => path,
  download: async (path: string, name: string) => { const a = document.createElement('a'); a.href = path; a.download = name; a.click(); },
};
