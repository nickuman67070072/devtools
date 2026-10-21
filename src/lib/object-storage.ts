import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { requiredEnvironment } from '@/lib/server-config';

let storage: S3Client | undefined;
type MemoryObject = { body: Uint8Array; contentType: string };
const memoryObjects = ((
  globalThis as typeof globalThis & { __pawmapE2eObjects?: Map<string, MemoryObject> }
).__pawmapE2eObjects ??= new Map<string, MemoryObject>());

function isE2eMemoryStorage() {
  return process.env.CI === 'true' && process.env.PAWMAP_E2E_OBJECT_STORAGE === 'memory';
}

function getStorage() {
  storage ??= new S3Client({
    region: process.env.S3_REGION?.trim() || 'us-east-1',
    endpoint: requiredEnvironment('S3_ENDPOINT'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnvironment('S3_ACCESS_KEY'),
      secretAccessKey: requiredEnvironment('S3_SECRET_KEY'),
    },
  });
  return storage;
}

const bucket = () => requiredEnvironment('S3_BUCKET');

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  if (isE2eMemoryStorage()) {
    memoryObjects.set(key, { body: Uint8Array.from(body), contentType });
    return;
  }
  return getStorage().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObject(key: string) {
  if (isE2eMemoryStorage()) {
    const object = memoryObjects.get(key);
    if (!object) throw new Error('Object not found');
    return {
      Body: { transformToByteArray: async () => Uint8Array.from(object.body) },
      ContentType: object.contentType,
    };
  }
  return getStorage().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function deleteObject(key: string) {
  if (isE2eMemoryStorage()) {
    memoryObjects.delete(key);
    return;
  }
  return getStorage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
