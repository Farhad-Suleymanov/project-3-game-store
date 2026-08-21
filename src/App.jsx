import "./App.css";
import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Filters from "./components/Filters"
import Header from "./components/Header";
import Games from "./components/Games";
import Support from "./components/Support";
import GameInfo from "./components/GameInfo";


function App() {

  const [showFilters, setShowFilters] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [genreValue, setGenreValue] = useState("");
  const [pc, setPc] = useState(false);
  const [xbox, setXbox] = useState(false);
  const [ps, setPs] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [theme, setTheme] = useState(false);

  useEffect(() => {
    document.body.style.backgroundColor = theme ? "#f5f7fb" : "#13151a";
  }, [theme]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <Header
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              inputValue={inputValue}
              setInputValue={setInputValue}
              favorites={favorites}
              setFavorites={setFavorites}
              theme={theme}
              setTheme={setTheme}
            />
            <Filters
              inputValue={inputValue}
              setInputValue={setInputValue}
              showFilters={showFilters}
              genreValue={genreValue}
              setGenreValue={setGenreValue}
              pc={pc}
              setPc={setPc}
              xbox={xbox}
              setXbox={setXbox}
              ps={ps}
              setPs={setPs}
              theme={theme}
              setTheme={setTheme}
            />
            <Games
              showFilters={showFilters}
              inputValue={inputValue}
              setInputValue={setInputValue}
              genreValue={genreValue}
              setGenreValue={setGenreValue}
              pc={pc}
              setPc={setPc}
              xbox={xbox}
              setXbox={setXbox}
              ps={ps}
              setPs={setPs}
              favorites={favorites}
              setFavorites={setFavorites}
              theme={theme}
              setTheme={setTheme}
              setSelectedGame={setSelectedGame}
            />
          </>
        }
      />
      <Route
        path="/support"
        element={<Support
          theme={theme}
          setTheme={setTheme}
        />}
      />
      <Route
        path="/game-info/:id"
        element={<GameInfo
            game={selectedGame}
            theme={theme} 
            setTheme={setTheme} />}
      />
    </Routes>
  );
}

export default App;