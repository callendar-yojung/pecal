export type UploadInput = {
  filename: string;
  contentType: string;
  data: Blob;
};

export type UploadResult = {
  fileId: string;
  url: string;
};

export type UploadApi = {
  upload: (input: UploadInput) => Promise<UploadResult>;
};
