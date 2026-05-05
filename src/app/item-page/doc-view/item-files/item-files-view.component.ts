import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Bitstream } from 'src/app/core/shared/bitstream.model';
import { Item } from 'src/app/core/shared/item.model';
import { ItemFileViewComponent } from '../item-file/item-file-view.component';

@Component({
  standalone: true,
  selector: 'item-files-view',
  templateUrl: './item-files-view.component.html',
  styleUrls: ['./item-files-view.component.scss'],
  imports: [CommonModule, ItemFileViewComponent],
})
export class ItemFilesViewComponent {
  @Input() bitstreams: Bitstream[];

  @Input() item: Item;

  selectedBitstream: Bitstream;

  ngOnInit(): void {
    if (this.bitstreams.length > 0) {
      console.log('this.bitstreams:', this.bitstreams);
      this.selectedBitstream = this.bitstreams[0];
    }
  }

  selectBitstream(bitstream: Bitstream): void {
    console.log('bitstream.bundleName:', bitstream.bundleName);
    this.selectedBitstream = bitstream;
    // DocViewer.renderFile(bitstream.self);
  }
}
