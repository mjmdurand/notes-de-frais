import io
from typing import BinaryIO

import boto3
from botocore.exceptions import ClientError

from ..config import settings


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"{'https' if settings.minio_secure else 'http'}://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        region_name="us-east-1",
    )


def ensure_bucket_exists():
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.minio_bucket_name)
    except ClientError:
        client.create_bucket(Bucket=settings.minio_bucket_name)


def upload_file(file_data: bytes, storage_path: str, content_type: str) -> str:
    client = get_s3_client()
    client.put_object(
        Bucket=settings.minio_bucket_name,
        Key=storage_path,
        Body=file_data,
        ContentType=content_type,
    )
    return storage_path


def download_file(storage_path: str) -> bytes:
    client = get_s3_client()
    response = client.get_object(Bucket=settings.minio_bucket_name, Key=storage_path)
    return response["Body"].read()


def get_presigned_url(storage_path: str, expiry: int = 3600) -> str:
    client = get_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket_name, "Key": storage_path},
        ExpiresIn=expiry,
    )
    if settings.minio_public_base_url:
        internal = f"{'https' if settings.minio_secure else 'http'}://{settings.minio_endpoint}"
        url = url.replace(internal, settings.minio_public_base_url.rstrip("/"), 1)
    return url


def delete_file(storage_path: str):
    client = get_s3_client()
    client.delete_object(Bucket=settings.minio_bucket_name, Key=storage_path)
