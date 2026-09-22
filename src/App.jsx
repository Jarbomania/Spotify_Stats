import { useState, useEffect, useRef } from "react";
import './App.css'
import { FormControl, InputGroup, Container, Button, Row, Card } from "react-bootstrap";
import { generateCodeVerifier, generateCodeChallenge } from "./Spotifyauth";

const clientId = import.meta.env.VITE_CLIENT_ID;
const redirectUri = "http://127.0.0.1:5173/";

function App() {
  const [searchInput, setSearchInput] = useState("");
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("access_token") || ""
  );
  const [albums, setAlbums] = useState([]);
  const [currentArtistID, setCurrentArtistID] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const hasExchanged = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code && !accessToken && !hasExchanged.current) {
      hasExchanged.current = true;
      exchangeCodeForToken(code);
    }
  }, []);

  async function redirectToSpotifyLogin() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem("code_verifier", codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "",
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
    });

    window.location.href =
      "https://accounts.spotify.com/authorize?" + params.toString();
  }

  async function exchangeCodeForToken(code) {
    const codeVerifier = localStorage.getItem("code_verifier");

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const result = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await result.json();

    if (data.access_token) {
      setAccessToken(data.access_token);
      localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }
      window.history.replaceState({}, document.title, "/");
    } else {
      console.error("Token exchange failed:", data);
    }
  }

  // Henter én "side" med album, enten fra et NYTT søk (offset 0) eller "Last flere" (økende offset)
  async function fetchAlbums(artistID, fetchOffset) {
    let artistParams = {
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };

    await fetch(
      "https://api.spotify.com/v1/artists/" +
        artistID +
        "/albums?include_groups=album&limit=10&offset=" +
        fetchOffset,
      artistParams
    )
      .then((result) => result.json())
      .then((data) => {
        const newAlbums = data.items || [];

        setAlbums((prevAlbums) =>
          fetchOffset === 0 ? newAlbums : [...prevAlbums, ...newAlbums]
        );

        // Spotify oppgir "next" som en URL hvis det finnes flere sider, ellers null
        setHasMore(Boolean(data.next));
        setOffset(fetchOffset + newAlbums.length);
      });
  }

  async function search() {
    let artistParams = {
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    };

    const artistID = await fetch(
      "https://api.spotify.com/v1/search?q=" + searchInput + "&type=artist",
      artistParams
    )
      .then((result) => result.json())
      .then((data) => data.artists.items[0].id);

    setCurrentArtistID(artistID);
    setAlbums([]); // nullstill ved nytt søk
    await fetchAlbums(artistID, 0);
  }

  function loadMore() {
    fetchAlbums(currentArtistID, offset);
  }

  return (
    <div className="App">
      <Container>
        {!accessToken ? (
          <Button onClick={redirectToSpotifyLogin}>Log in with Spotify</Button>
        ) : (
          <InputGroup>
            <FormControl
              placeholder="Search For Artist"
              value={searchInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") search();
              }}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: "300px",
                height: "35px",
                borderWidth: "0px",
                borderRadius: "5px",
                marginRight: "10px",
                paddingLeft: "10px",
              }}
            />
            <Button onClick={search}>Search</Button>
          </InputGroup>
        )}
      </Container>

      <Container>
        <Row
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-around",
            alignContent: "center",
          }}
        >
          {(albums || []).map((album) => (
            <Card
              key={album.id}
              style={{
                backgroundColor: "white",
                margin: "10px",
                borderRadius: "5px",
                marginBottom: "30px",
              }}
            >
              <Card.Img
                width={200}
                src={album.images[0]?.url}
                style={{ borderRadius: "4%" }}
              />
              <Card.Body>
                <Card.Title
                  style={{
                    whiteSpace: "wrap",
                    fontWeight: "bold",
                    maxWidth: "200px",
                    fontSize: "18px",
                    marginTop: "10px",
                    color: "black",
                  }}
                >
                  {album.name}
                </Card.Title>
                <Card.Text style={{ color: "black" }}>
                  Release Date: <br /> {album.release_date}
                </Card.Text>
                <Button
                  href={album.external_urls.spotify}
                  style={{
                    backgroundColor: "black",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "15px",
                    borderRadius: "5px",
                    padding: "10px",
                  }}
                >
                  Album Link
                </Button>
              </Card.Body>
            </Card>
          ))}
        </Row>

        {hasMore && (
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <Button onClick={loadMore}>Last flere album</Button>
          </div>
        )}
      </Container>
    </div>
  );
}

export default App;