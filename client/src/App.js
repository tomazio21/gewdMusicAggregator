import React, { Component } from 'react';
import './App.css';

class App extends Component {

  render() {
    return (
      <div className="App">
        <header>
          <h1>Gewd music aggregator</h1>
        </header>
        <div className="container">
          <SongTable/>
        </div>
      </div>
    );
  }
}

class SongTable extends Component {
  constructor(props) {
    super(props);
    this.state = {
      songs: [],
      sortFilter: 'byDate',
      reversed: false
    };
  }

  componentDidMount() {
      let url = '/' + this.state.sortFilter;
      fetch(url)
      .then(response => response.json())
      .then(updatedSongs => {
          this.setState({
            songs: updatedSongs
          })
      })
      .catch(error => {
          console.error(error.message);
      })
      //this.startPolling();
  }

  componentWillUnmount() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
  }
  
  startPolling() {
      var self = this;
      setTimeout(function() {
        self.poll();
        self.timer = setInterval(self.poll.bind(self), 5000);
      }, 1000);
  }
  
  poll(column) {
      let queryURL = '/';
      let newReversedState;
      let newSortFilterState;
      
      if(typeof column !== 'undefined') { //clicked column
        if(column === this.state.sortFilter) { //clicked column to reverse sort
          newReversedState = !this.state.reversed;
          newSortFilterState = column;
        } else { //clicked new column
          newReversedState = false;
          newSortFilterState = column;
        }
      } else { //regular polling
        newReversedState = this.state.reversed;
        newSortFilterState = this.state.sortFilter;
      }

      queryURL += newReversedState ? newSortFilterState + 'Rev': newSortFilterState;

      fetch(queryURL)
      .then(response => response.json())
      .then(updatedSongs => {
        this.setState({
          songs: updatedSongs,
          sortFilter : newSortFilterState,
          reversed : newReversedState
        })
      })
      .catch(error => {
          console.error(error.message);
      })
  }

  render() {
      const songs = [];
      this.state.songs.forEach((song) => {
        songs.push(
          <Song song={song} />
        );
      });

      return (
        <table>
          <thead>
            <tr id='headerRow'>
              <th><a href="#" onClick={this.poll.bind(this,"bySong")}>Song name</a></th>
              <th><a href="#" onClick={this.poll.bind(this,"byArtist")}>Artist</a></th>
              <th><a href="#" onClick={this.poll.bind(this,"byAlbum")}>Album</a></th>
              <th><a href="#" onClick={this.poll.bind(this,"byUser")}>User</a></th>
              <th><a href="#" onClick={this.poll.bind(this,"byReactions")}>Reactions</a></th>
              <th><a href="#" onClick={this.poll.bind(this,"byDate")}>Date posted</a></th>
            </tr>
          </thead>
          <tbody>
              {songs}
          </tbody>
        </table>
      );
  }
}

class Song extends Component {

  render() {
    const song = this.props.song;
    const name = song.name;
    const artist = song.artist;
    const link = song.link;
    const user = song.user;
    const reactions = song.reactions;
    const album = song.album;
    const dateSubmitted = new Date(song.date_posted * 1000).toDateString();
    let songRow = (name && artist && album) ? '<a href=' + link +  ' target="_blank">' + name + '</a>' : name;
    let artistRow = (!name && artist && !album) ? '<a href=' + link +  ' target="_blank">' + artist + '</a>' : artist;
    let albumRow = (!name && artist && album) ? '<a href=' + link +  ' target="_blank">' + album + '</a>' : album;
    return (
      <tr>
        <td dangerouslySetInnerHTML={{__html: songRow}}></td>
        <td dangerouslySetInnerHTML={{__html: artistRow}}></td>
        <td dangerouslySetInnerHTML={{__html: albumRow}}></td>
        <td>{user}</td>
        <td>{reactions}</td>
        <td>{dateSubmitted}</td>
      </tr>
    );
  }
}

export default App;