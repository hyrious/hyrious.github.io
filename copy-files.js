import fs from "fs";
import path from "path";

fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist", { recursive: true });

["CNAME", "index.html", "style.css"].forEach((file) => {
  fs.copyFileSync(file, path.join("dist", file));
});
fs.writeFileSync(path.join("dist", ".nojekyll"), "keepme\n");
