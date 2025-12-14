import crypto from "crypto";

export default async function handler(req, res) {
    try {
        /* =======================
        Generate Guest Token
        ======================= */
        const bin = crypto.randomBytes(16).toString("hex");
        const guestToken =
        bin.slice(0, 8) + "-" +
        bin.slice(8, 12) + "-" +
        bin.slice(12, 16) + "-" +
        bin.slice(16, 20) + "-" +
        bin.slice(20);

        /* =======================
        Generate DD Token
        ======================= */
        const ddToken = Buffer.from(JSON.stringify({
        schema_version: "1",
        os_name: "N/A",
        os_version: "N/A",
        platform_name: "Chrome",
        platform_version: "104",
        device_name: "",
        app_name: "Web",
        app_version: "2.52.31",
        player_capabilities: {
            audio_channel: ["STEREO"],
            video_codec: ["H264"],
            container: ["MP4", "TS"],
            package: ["DASH", "HLS"],
            resolution: ["240p", "SD", "HD", "FHD"],
            dynamic_range: ["SDR"]
        },
        security_capabilities: {
            encryption: ["WIDEVINE_AES_CTR"],
            widevine_security_level: ["L3"],
            hdcp_version: ["HDCP_V1", "HDCP_V2", "HDCP_V2_1", "HDCP_V2_2"]
        }
        })).toString("base64");

        /* =======================
        Fetch Platform Token
        ======================= */
        const platformResp = await fetch(
        "https://www.zee5.com/live-tv/aaj-tak/0-9-aajtak",
        {
            headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
            }
        }
        );

        if (!platformResp.ok) {
        return res.status(403).send("Your server IP is blocked.");
        }

        const platformHtml = await platformResp.text();
        const match = platformHtml.match(/"gwapiPlatformToken"\s*:\s*"([^"]+)"/);

        if (!match) {
        return res.status(500).send("Platform token not found.");
        }

        const platformToken = match[1];

        /* =======================
        Fetch M3U8 URL
        ======================= */
        const apiUrl =
        "https://spapi.zee5.com/singlePlayback/getDetails/secure" +
        "?channel_id=0-9-9z583538" +
        "&device_id=" + guestToken +
        "&platform_name=desktop_web" +
        "&translation=en" +
        "&user_language=en,hi,te" +
        "&country=IN" +
        "&state=" +
        "&app_version=4.24.0" +
        "&user_type=guest" +
        "&check_parental_control=false";

        const apiResp = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://www.zee5.com",
            "Referer": "https://www.zee5.com/",
            "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
        },
        body: JSON.stringify({
            "x-access-token": platformToken,
            "X-Z5-Guest-Token": guestToken,
            "x-dd-token": ddToken
        })
        });

        if (!apiResp.ok) {
        return res.status(500).send("Invalid API response.");
        }

        const apiData = await apiResp.json();
        const m3u8Url = apiData?.keyOsDetails?.video_token;

        if (!m3u8Url || !m3u8Url.startsWith("http")) {
        return res.status(500).send("M3U8 URL not found.");
        }

        /* =======================
        Extract hdntl token
        ======================= */
        const m3u8Resp = await fetch(m3u8Url, {
        headers: {
            "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
        }
        });

        if (!m3u8Resp.ok) {
        return res.status(500).send("Unable to load M3U8.");
        }

        const m3u8Text = await m3u8Resp.text();
        const hdntlMatch = m3u8Text.match(/hdntl=([^\s"]+)/);

        if (!hdntlMatch) {
        return res.status(500).send("hdntl token not found.");
        }

        res.setHeader("Content-Type", "text/plain");
        return res.status(200).send(hdntlMatch[0]);

    } catch (err) {
        return res.status(500).send("Error: " + err.message);
    }
}