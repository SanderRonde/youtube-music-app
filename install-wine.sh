git clone git://source.winehq.org/git/wine.git
cd wine
sudo apt-get update
sudo apt-get install build-essential
./configure --enable-win64
make