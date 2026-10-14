import {dropEpisodeDialog, keepEpisodeDialog, takeEpisodeDialog} from './episodeDialogReturn';

describe('episodeDialogReturn', () => {
	afterEach(() => {
		dropEpisodeDialog();
		jest.restoreAllMocks();
	});

	it('hands the kept place back once, with the episode it was kept for', () => {
		const episodes = [{Id: 'a'}, {Id: 'b'}];
		keepEpisodeDialog({episodeId: 'b', season: 2, personId: '7'});
		expect(takeEpisodeDialog(episodes)).toMatchObject({episode: {Id: 'b'}, season: 2, personId: '7'});
		expect(takeEpisodeDialog(episodes)).toBeNull();
	});

	it('keeps the place while the episode has not come in yet', () => {
		keepEpisodeDialog({episodeId: 'b', season: 2, personId: '7'});
		expect(takeEpisodeDialog([{Id: 'a'}])).toBeNull();
		expect(takeEpisodeDialog([{Id: 'b'}])).not.toBeNull();
	});

	it('lets a place go after a while', () => {
		const now = jest.spyOn(Date, 'now');
		now.mockReturnValue(1000);
		keepEpisodeDialog({episodeId: 'b'});
		now.mockReturnValue(1000 + 31 * 60 * 1000);
		expect(takeEpisodeDialog([{Id: 'b'}])).toBeNull();
	});
});
