import { headers, datas } from "./constants.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { parse } from "content-disposition";

//项目个数,251
let curPage = 1;
let maxPage = 0;
let allProjectsNum = 0;
let arrProjects = [];

//项目文件信息
let projectInfo = [];

//获取项目个数
async function getAllProjects() {
  let data = datas;
  data.pageNum = curPage;
  const response = await axios({
    method: "post",
    url: "http://cmsng.chinatowercom.cn:28888/management/contract/getListByES",
    headers: headers,
    data: datas,
  });
  allProjectsNum = response.data.data.total;
  arrProjects = response.data.data.data;
  maxPage = Math.round(allProjectsNum / 100);
}

//获取要下载文件的信息
async function getProjectsInfo(dataId, projectName, yearNum) {
  const response = await axios({
    method: "get",
    url:
      "http://cmsng.chinatowercom.cn:28888/wps/cms/api/getWPSFileInfoALLByContractId",
    headers: headers,
    params: {
      contractId: dataId,
      cmsType: "ALL",
    },
  });
  projectInfo = response.data.data;
  if (projectInfo) {
    for (let item of projectInfo) {
      if (item.modifier_id) {
        await downloadFileUrl(
          item.type,
          item.file_id,
          item.modifier_id,
          projectName,
          yearNum
        );
      } else {
        continue;
      }
    }
  }
}

async function createFile(year, fileName) {
  // 创建本地文件路径
  fs.mkdir(`./fils/${year}/${fileName}`, { recursive: false }, (err) => {
    if (err) throw err;
  });
}

//下载
async function startFun() {
  await getAllProjects();
  //遍历数组
  for (let item of arrProjects) {
    //创建文件
    let year = item.sourceMap.contractGno.slice(4, 8);
    await createFile(year, item.sourceMap.contractTitle);
    await getProjectsInfo(item.dataId, item.sourceMap.contractTitle, year);
  }
}
startFun();

async function downloadFileUrl(cmsType, fileId, userId, projectName, yearNum) {
  const response = await axios({
    method: "post",
    url: "http://cmsng.chinatowercom.cn:28888/wps/cms/api/getDownloadLink",
    headers: headers,
    data: {
      cmsType: cmsType,
      fileId: fileId,
      userId: userId,
    },
  });
  let downUrl = response.data.data;
  await downloadFile(downUrl, projectName, yearNum);
}

async function downloadFile(downUrl, projectName, yearNum) {
  const { fileName } = await detectFileTypeFromUrl(downUrl);
  try {
    const response = await axios({
      url: downUrl,
      method: "GET",
      responseType: "stream", // 指定响应类型为流
    });

    const filePath = path.join(
      `./fils/${yearNum}/${projectName}`,
      `${fileName}`
    );

    // 写入文件
    const writeStream = fs.createWriteStream(filePath);
    response.data.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    console.log(`文件已成功下载并保存为 ${filePath}`);
  } catch (error) {
    console.error("下载错误:", error);
  }
}

//判断文件类型
async function detectFileTypeFromUrl(url) {
  if (url) {
    const response = await axios.head(url);
    const contentDispositionHeader =
      response.headers["content-disposition"] || "";

    // 解析Content-Disposition header获取文件名和类型
    const contentDisposition = parse(contentDispositionHeader);
    let fileName = contentDisposition.parameters.filename;
    if (!fileName) {
      console.warn(
        "未能从Content-Disposition中获取文件名，将使用URL最后的部分作为文件名"
      );
      fileName = path.basename(url);
    }
    return { fileName };
  }
}
