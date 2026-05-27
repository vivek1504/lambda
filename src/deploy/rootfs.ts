import extract from "extract-zip";
import { exec as execCb, spawn } from "child_process";
import { promisify } from "util";

const exec = promisify(execCb);

export async function extractZip(zip: string, outputDir: string) {
  await extract(zip, {
    dir: outputDir,
    onEntry: (entry) => {
      if (entry.fileName.includes("..")) {
        throw new Error("Invalid zip content");
      }
    },
  });
}

export async function prepareRootfs(functionId: string) {
  const baseImage = "rootfs.ext4";
  const image = `rootfs/rootfs-${functionId}.ext4`;

  await exec(`cp --reflink=auto ${baseImage} ${image}`);

  const mountDir = `/mnt/rootfs-${functionId}`;
  const extracted = `extracted/${functionId}`;

  await exec(`sudo mkdir -p ${mountDir}`);
  await exec(`sudo mount -o loop ${image} ${mountDir}`);

  await exec(`sudo cp -r ${extracted}/. ${mountDir}/app/`);

  await exec(`sudo umount ${mountDir}`);
  await exec(`sudo rm -rf ${mountDir}`);

  return image;
}
